import { describe, expect, it, vi } from 'vitest';
import type { Clock } from './clock.js';
import { groupByOffset, RunExecutor, type ActiveRun } from './runExecutor.js';
import { dispatchRow } from './testFixtures.js';
import type { Cursor, DispatchRow, KafkaMessage, RunStatus, RunStore, SimulationRun } from './types.js';

const STARTED_AT = new Date('2026-10-25T10:00:00.000Z');
const silentLogger = { info: () => {}, warn: () => {}, error: () => {} };

/** Time moves only when the executor sleeps, so a long run takes no real time. */
function fakeClock(startMs = STARTED_AT.getTime()) {
  let nowMs = startMs;
  const clock: Clock = {
    now: () => new Date(nowMs),
    async sleepUntil(time, signal) {
      signal.throwIfAborted();
      nowMs = Math.max(nowMs, time.getTime());
      await Promise.resolve();
      signal.throwIfAborted();
    },
  };
  return clock;
}

function fakeStore(rows: DispatchRow[]) {
  const state = {
    status: 'started' as RunStatus,
    cursor: null as Cursor | null,
    dispatched: 0,
    failureReason: null as string | null,
  };
  const after = (row: DispatchRow, cursor: Cursor | null) => cursor === null
    || row.dispatch_offset_s > cursor.offsetS
    || (row.dispatch_offset_s === cursor.offsetS && BigInt(row.report_id) > BigInt(cursor.reportId));

  const store: RunStore = {
    fetchBatch: vi.fn(async (_simulationId: string, cursor: Cursor | null, limit: number) =>
      rows.filter((row) => after(row, cursor)).slice(0, limit)),
    getStatus: vi.fn(async () => state.status),
    saveProgress: vi.fn(async (_runId: string, cursor: Cursor, sentCount: number) => {
      if (state.status !== 'started') return false;
      state.cursor = cursor;
      state.dispatched += sentCount;
      return true;
    }),
    finishRun: vi.fn(async (_runId: string, status: Exclude<RunStatus, 'started'>, failureReason?: string) => {
      if (state.status !== 'started') return null;
      state.status = status;
      state.failureReason = failureReason ?? null;
      return { id: 'run-1', status, dispatched_count: state.dispatched } as SimulationRun;
    }),
  };
  return { store, state };
}

function recordingPublisher(clock: Clock) {
  const sends: { at: string; keys: string[] }[] = [];
  const publisher = {
    send: vi.fn(async (messages: KafkaMessage[]) => {
      sends.push({ at: clock.now().toISOString(), keys: messages.map((message) => message.key) });
    }),
  };
  return { publisher, sends };
}

const run = (cursor: Cursor | null = null): ActiveRun => ({
  id: 'run-1', simulationId: 'sim-1', startedAt: STARTED_AT, cursor,
});

// Offsets 0, 10, 10, 30. With batches of 2, offset 10 is split across two batches.
const rows = [
  dispatchRow({ dispatch_offset_s: 0, report_id: '1' }),
  dispatchRow({ dispatch_offset_s: 10, report_id: '2' }),
  dispatchRow({ dispatch_offset_s: 10, report_id: '3' }),
  dispatchRow({ dispatch_offset_s: 30, report_id: '4' }),
];

describe('RunExecutor', () => {
  it('sends every report at started_at + offset, in order, then completes the run', async () => {
    const clock = fakeClock();
    const { store, state } = fakeStore(rows);
    const { publisher, sends } = recordingPublisher(clock);

    await new RunExecutor({ store, publisher, clock, batchSize: 2, logger: silentLogger }, run()).start();

    expect(sends).toEqual([
      { at: '2026-10-25T10:00:00.000Z', keys: ['1:1'] },
      { at: '2026-10-25T10:00:10.000Z', keys: ['1:2'] },
      { at: '2026-10-25T10:00:10.000Z', keys: ['1:3'] },
      { at: '2026-10-25T10:00:30.000Z', keys: ['1:4'] },
    ]);
    expect(state).toEqual({
      status: 'completed', cursor: { offsetS: 30, reportId: '4' }, dispatched: 4, failureReason: null,
    });
  });

  it('sends reports that share an offset in one send', async () => {
    const clock = fakeClock();
    const { store } = fakeStore(rows);
    const { publisher, sends } = recordingPublisher(clock);

    await new RunExecutor({ store, publisher, clock, batchSize: 100, logger: silentLogger }, run()).start();

    expect(sends.map((send) => send.keys)).toEqual([['1:1'], ['1:2', '1:3'], ['1:4']]);
  });

  it('resumes after the saved cursor and sends overdue reports immediately', async () => {
    // The backend was down until 2 minutes into the run.
    const clock = fakeClock(STARTED_AT.getTime() + 120_000);
    const { store, state } = fakeStore(rows);
    const { publisher, sends } = recordingPublisher(clock);

    await new RunExecutor(
      { store, publisher, clock, batchSize: 2, logger: silentLogger },
      run({ offsetS: 10, reportId: '2' }),
    ).start();

    expect(sends).toEqual([
      { at: '2026-10-25T10:02:00.000Z', keys: ['1:3'] },
      { at: '2026-10-25T10:02:00.000Z', keys: ['1:4'] },
    ]);
    expect(state.status).toBe('completed');
  });

  it('stops sending when aborted and leaves the run status alone', async () => {
    const clock = fakeClock();
    const { store, state } = fakeStore(rows);
    const { publisher, sends } = recordingPublisher(clock);
    const executor = new RunExecutor({ store, publisher, clock, batchSize: 2, logger: silentLogger }, run());
    publisher.send.mockImplementationOnce(async (messages) => {
      sends.push({ at: clock.now().toISOString(), keys: messages.map((message) => message.key) });
      executor.abort();
    });

    await executor.start();

    expect(sends.map((send) => send.keys)).toEqual([['1:1']]);
    expect(state.status).toBe('started');
    expect(store.finishRun).not.toHaveBeenCalled();
  });

  it('stops sending when the run was stopped outside the executor', async () => {
    const clock = fakeClock();
    const { store, state } = fakeStore(rows);
    const { publisher, sends } = recordingPublisher(clock);
    publisher.send.mockImplementationOnce(async (messages) => {
      sends.push({ at: clock.now().toISOString(), keys: messages.map((message) => message.key) });
      state.status = 'stopped';
    });

    await new RunExecutor({ store, publisher, clock, batchSize: 2, logger: silentLogger }, run()).start();

    expect(sends.map((send) => send.keys)).toEqual([['1:1']]);
    expect(state.status).toBe('stopped');
  });

  it('fails the run when Kafka rejects a send, keeping the last confirmed position', async () => {
    const clock = fakeClock();
    const { store, state } = fakeStore(rows);
    const { publisher } = recordingPublisher(clock);
    publisher.send
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Broker transport failure'));

    await new RunExecutor({ store, publisher, clock, batchSize: 2, logger: silentLogger }, run()).start();

    expect(state).toEqual({
      status: 'failed', cursor: { offsetS: 0, reportId: '1' }, dispatched: 1, failureReason: 'Broker transport failure',
    });
  });

  it('retries a failed database call before giving up', async () => {
    const clock = fakeClock();
    const { store, state } = fakeStore(rows);
    const { publisher } = recordingPublisher(clock);
    vi.mocked(store.fetchBatch).mockRejectedValueOnce(new Error('connection reset'));

    await new RunExecutor(
      { store, publisher, clock, batchSize: 2, dbRetryDelaysMs: [0], logger: silentLogger },
      run(),
    ).start();

    expect(state.status).toBe('completed');
    expect(state.dispatched).toBe(4);
  });

  it('fails the run once database retries run out', async () => {
    const clock = fakeClock();
    const { store, state } = fakeStore(rows);
    const { publisher } = recordingPublisher(clock);
    vi.mocked(store.fetchBatch).mockRejectedValue(new Error('database is down'));

    await new RunExecutor(
      { store, publisher, clock, batchSize: 2, dbRetryDelaysMs: [0, 0], logger: silentLogger },
      run(),
    ).start();

    expect(store.fetchBatch).toHaveBeenCalledTimes(3);
    expect(state.status).toBe('failed');
    expect(state.failureReason).toBe('database is down');
    expect(publisher.send).not.toHaveBeenCalled();
  });
});

describe('groupByOffset', () => {
  it('groups consecutive rows with the same offset', () => {
    const groups = groupByOffset(rows).map((group) => group.map((row) => row.report_id));
    expect(groups).toEqual([['1'], ['2', '3'], ['4']]);
  });
});
