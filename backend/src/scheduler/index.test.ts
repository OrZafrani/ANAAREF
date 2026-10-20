import { describe, expect, it, vi } from 'vitest';
import { ConflictError, NotFoundError } from '../lib/validate.js';
import type { Clock } from './clock.js';
import { createScheduler } from './index.js';
import type { SchedulerStore, SimulationForStart, SimulationRun } from './types.js';

const silentLogger = { info: () => {}, warn: () => {}, error: () => {} };

// Never resolves on its own, so an executor stays "dispatching" until aborted.
const idleClock: Clock = {
  now: () => new Date(),
  sleepUntil: (_time, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }),
};

const startedRun = (overrides: Partial<SimulationRun> = {}): SimulationRun => ({
  id: 'run-1',
  simulation_id: 'sim-1',
  started_at: new Date('2026-10-25T10:00:00.000Z'),
  completed_at: null,
  status: 'started',
  cursor_offset_s: null,
  cursor_report_id: null,
  dispatched_count: 0,
  failure_reason: null,
  ...overrides,
});

const runnableSimulation: SimulationForStart = {
  id: 'sim-1', reality_id: 1, target_system: 'specter', report_count: 3, other_reality_report_count: 0, missing_fields: [],
};

function makeScheduler(store: Partial<SchedulerStore>) {
  const fullStore: SchedulerStore = {
    getSimulationForStart: vi.fn(async () => runnableSimulation),
    createRun: vi.fn(async () => startedRun()),
    getRun: vi.fn(async () => null),
    stopRun: vi.fn(async () => null),
    listStartedRuns: vi.fn(async () => []),
    failOverdueRuns: vi.fn(async () => []),
    fetchBatch: vi.fn(async () => [
      { dispatch_offset_s: 60, report_id: '1' } as never,
    ]),
    getStatus: vi.fn(async () => 'started' as const),
    saveProgress: vi.fn(async () => true),
    finishRun: vi.fn(async () => null),
    ...store,
  };
  const scheduler = createScheduler({
    store: fullStore,
    publisher: { send: vi.fn(async () => undefined) },
    clock: idleClock,
    batchSize: 100,
    runTimeoutGraceS: 300,
    watchdogIntervalS: 3600,
    logger: silentLogger,
  });
  return { scheduler, store: fullStore };
}

describe('scheduler.startRun', () => {
  it('creates a run and starts dispatching it', async () => {
    const { scheduler, store } = makeScheduler({});
    await expect(scheduler.startRun('sim-1')).resolves.toMatchObject({ id: 'run-1', status: 'started' });
    expect(store.createRun).toHaveBeenCalledWith('sim-1');
    expect(scheduler.activeRunIds()).toEqual(['run-1']);
    await scheduler.shutdown();
  });

  it.each<[string, SimulationForStart | null, number]>([
    ['a missing simulation', null, 404],
    ['a COMBAT simulation', { ...runnableSimulation, target_system: 'combat' }, 422],
    ['a simulation outside reality 1', { ...runnableSimulation, reality_id: 2 }, 422],
    ['a simulation with no reports', { ...runnableSimulation, report_count: 0 }, 422],
    ['a simulation with reports in another reality', { ...runnableSimulation, other_reality_report_count: 1 }, 422],
    ['a simulation with reports missing required fields', { ...runnableSimulation, missing_fields: ['city'] }, 422],
  ])('rejects %s', async (_case, simulation, statusCode) => {
    const { scheduler, store } = makeScheduler({ getSimulationForStart: vi.fn(async () => simulation) });
    await expect(scheduler.startRun('sim-1')).rejects.toMatchObject({ statusCode });
    expect(store.createRun).not.toHaveBeenCalled();
  });

  it('passes on the conflict when a run is already started', async () => {
    const { scheduler } = makeScheduler({
      createRun: vi.fn(async () => { throw new ConflictError('Simulation already has a started run'); }),
    });
    await expect(scheduler.startRun('sim-1')).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('scheduler.stopRun', () => {
  it('stops the run and its executor', async () => {
    const stopped = startedRun({ status: 'stopped', completed_at: new Date() });
    const { scheduler } = makeScheduler({ stopRun: vi.fn(async () => stopped) });
    await scheduler.startRun('sim-1');

    await expect(scheduler.stopRun('sim-1', 'run-1')).resolves.toBe(stopped);
    expect(scheduler.activeRunIds()).toEqual([]);
  });

  it('returns 404 for an unknown run and 409 for a finished one', async () => {
    const missing = makeScheduler({});
    await expect(missing.scheduler.stopRun('sim-1', 'run-1')).rejects.toBeInstanceOf(NotFoundError);

    const finished = makeScheduler({ getRun: vi.fn(async () => startedRun({ status: 'completed' })) });
    await expect(finished.scheduler.stopRun('sim-1', 'run-1')).rejects.toThrow('Run is not running (status: completed)');
  });
});

describe('scheduler.recoverRuns', () => {
  it('fails timed-out runs first, then resumes started runs from their cursor', async () => {
    const calls: string[] = [];
    const { scheduler, store } = makeScheduler({
      failOverdueRuns: vi.fn(async () => { calls.push('failOverdueRuns'); return []; }),
      listStartedRuns: vi.fn(async () => {
        calls.push('listStartedRuns');
        return [startedRun({ id: 'run-2', cursor_offset_s: 10, cursor_report_id: '2' })];
      }),
    });

    await expect(scheduler.recoverRuns()).resolves.toBe(1);

    expect(calls).toEqual(['failOverdueRuns', 'listStartedRuns']);
    expect(scheduler.activeRunIds()).toEqual(['run-2']);
    expect(store.fetchBatch).toHaveBeenCalledWith('sim-1', { offsetS: 10, reportId: '2' }, 100);
    await scheduler.shutdown();
  });
});
