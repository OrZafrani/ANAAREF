import { setTimeout as sleep } from 'node:timers/promises';
import type { Clock } from './clock.js';
import { buildReportMessage } from './reportMessage.js';
import type { Cursor, DispatchRow, Logger, ReportPublisher, RunStore } from './types.js';

export interface RunExecutorDeps {
  store: RunStore;
  publisher: ReportPublisher;
  clock: Clock;
  batchSize: number;
  /** Waits between attempts of a failed database call. Its length is the number of retries. */
  dbRetryDelaysMs?: number[];
  logger?: Logger;
}

/** What an executor needs to know about its run. */
export interface ActiveRun {
  id: string;
  simulationId: string;
  startedAt: Date;
  /** Resume after this report; null to start from the first one. */
  cursor: Cursor | null;
}

const DEFAULT_DB_RETRY_DELAYS_MS = [500, 2_000, 5_000];

/**
 * Dispatches one run's reports in (dispatch_offset_s, report_id) order, each at
 * started_at + dispatch_offset_s. Overdue reports (after a restart) go out at once, in order.
 *
 * Progress is saved after Kafka confirms each send. A crash between the two
 * resends that send on resume, so Specter may see a few repeated reports.
 */
export class RunExecutor {
  private readonly abortController = new AbortController();
  private readonly log: Logger;
  private running: Promise<void> | null = null;

  constructor(private readonly deps: RunExecutorDeps, readonly run: ActiveRun) {
    this.log = deps.logger ?? console;
  }

  /** Starts dispatching. Resolves when the run ends or the executor is aborted; never rejects. */
  start(): Promise<void> {
    this.running ??= this.execute();
    return this.running;
  }

  /** Stops dispatching without changing the run's status (stop and shutdown use this). */
  abort(): void {
    this.abortController.abort();
  }

  get finished(): Promise<void> {
    return this.running ?? Promise.resolve();
  }

  private get signal(): AbortSignal {
    return this.abortController.signal;
  }

  private async execute(): Promise<void> {
    try {
      await this.dispatchAll();
    } catch (error) {
      if (this.signal.aborted) return;
      const reason = error instanceof Error ? error.message : String(error);
      this.log.error(`[scheduler] Run ${this.run.id} failed:`, error);
      try {
        await this.deps.store.finishRun(this.run.id, 'failed', reason);
      } catch (finishError) {
        // The watchdog fails the run later if this keeps failing.
        this.log.error(`[scheduler] Could not mark run ${this.run.id} as failed:`, finishError);
      }
    }
  }

  private async dispatchAll(): Promise<void> {
    const { store, publisher, clock, batchSize } = this.deps;
    let next = this.fetchAfter(this.run.cursor, batchSize);

    for (;;) {
      const batch = await next;
      if (this.signal.aborted) return;

      if (batch.length === 0) {
        const finished = await this.withDbRetry(() => store.finishRun(this.run.id, 'completed'));
        if (finished) this.log.info(`[scheduler] Run ${this.run.id} completed (${finished.dispatched_count} reports)`);
        return;
      }

      // Fetch the following batch while this one is being sent.
      const last = batch[batch.length - 1];
      next = this.fetchAfter({ offsetS: last.dispatch_offset_s, reportId: last.report_id }, batchSize);
      next.catch(() => undefined); // Awaited on the next pass; avoids an unhandled rejection if we stop first.

      for (const group of groupByOffset(batch)) {
        await clock.sleepUntil(this.dueAt(group[0].dispatch_offset_s), this.signal);

        // Stop requests normally arrive through abort(); this also catches a run
        // stopped or failed by anything else, before sending to it.
        const status = await this.withDbRetry(() => store.getStatus(this.run.id));
        if (status !== 'started' || this.signal.aborted) return;

        const sentAt = clock.now();
        await publisher.send(group.map((row) => buildReportMessage(row, sentAt)));

        const groupLast = group[group.length - 1];
        const cursor = { offsetS: groupLast.dispatch_offset_s, reportId: groupLast.report_id };
        const saved = await this.withDbRetry(() => store.saveProgress(this.run.id, cursor, group.length));
        if (!saved) return;
      }
    }
  }

  private fetchAfter(cursor: Cursor | null, limit: number): Promise<DispatchRow[]> {
    return this.withDbRetry(() => this.deps.store.fetchBatch(this.run.simulationId, cursor, limit));
  }

  private dueAt(offsetS: number): Date {
    return new Date(this.run.startedAt.getTime() + offsetS * 1000);
  }

  private async withDbRetry<T>(operation: () => Promise<T>): Promise<T> {
    const delays = this.deps.dbRetryDelaysMs ?? DEFAULT_DB_RETRY_DELAYS_MS;
    for (let attempt = 0; ; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt >= delays.length || this.signal.aborted) throw error;
        this.log.warn(`[scheduler] Run ${this.run.id}: database call failed, retrying:`, error);
        await sleep(delays[attempt], undefined, { signal: this.signal });
      }
    }
  }
}

/** Splits rows (already in dispatch order) into runs of the same dispatch_offset_s. */
export function groupByOffset(rows: DispatchRow[]): DispatchRow[][] {
  const groups: DispatchRow[][] = [];
  for (const row of rows) {
    const current = groups[groups.length - 1];
    if (current && current[0].dispatch_offset_s === row.dispatch_offset_s) current.push(row);
    else groups.push([row]);
  }
  return groups;
}
