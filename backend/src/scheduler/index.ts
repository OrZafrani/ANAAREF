import { ApiError, ConflictError, NotFoundError } from '../lib/validate.js';
import type { Clock } from './clock.js';
import { SIMULATION_REALITY_ID } from './reportMessage.js';
import { RunExecutor, type ActiveRun } from './runExecutor.js';
import type { Logger, ReportPublisher, SchedulerStore, SimulationRun } from './types.js';

export interface SchedulerDeps {
  store: SchedulerStore;
  publisher: ReportPublisher;
  clock: Clock;
  batchSize: number;
  runTimeoutGraceS: number;
  watchdogIntervalS: number;
  dbRetryDelaysMs?: number[];
  logger?: Logger;
}

export type Scheduler = ReturnType<typeof createScheduler>;

/**
 * Runs simulations: one RunExecutor per started run, in this process.
 * Assumes a single backend instance; several would each send the same runs.
 */
export function createScheduler(deps: SchedulerDeps) {
  const { store } = deps;
  const log = deps.logger ?? console;
  const executors = new Map<string, RunExecutor>();
  let watchdog: NodeJS.Timeout | null = null;

  function launch(run: SimulationRun): void {
    if (executors.has(run.id)) return;
    const activeRun: ActiveRun = {
      id: run.id,
      simulationId: run.simulation_id,
      startedAt: run.started_at,
      cursor: run.cursor_offset_s === null || run.cursor_report_id === null
        ? null
        : { offsetS: run.cursor_offset_s, reportId: run.cursor_report_id },
    };
    const executor = new RunExecutor(deps, activeRun);
    executors.set(run.id, executor);
    void executor.start().finally(() => executors.delete(run.id));
  }

  async function failOverdueRuns(): Promise<void> {
    const ids = await store.failOverdueRuns(deps.runTimeoutGraceS);
    for (const id of ids) {
      log.warn(`[scheduler] Run ${id} timed out and was marked failed`);
      executors.get(id)?.abort();
    }
  }

  return {
    /** Creates a started run for the simulation and begins dispatching its reports. */
    async startRun(simulationId: string): Promise<SimulationRun> {
      const simulation = await store.getSimulationForStart(simulationId);
      if (!simulation) throw new NotFoundError('Simulation not found');
      if (simulation.target_system !== 'specter') {
        throw new ApiError('Only Specter simulations can run; COMBAT mode is not supported yet', 422);
      }
      if (simulation.reality_id !== SIMULATION_REALITY_ID) {
        throw new ApiError(`Simulations can only run in reality ${SIMULATION_REALITY_ID}`, 422);
      }
      if (simulation.report_count === 0) {
        throw new ApiError('Simulation has no reports to dispatch', 422);
      }
      if (simulation.other_reality_report_count > 0) {
        throw new ApiError(
          `${simulation.other_reality_report_count} of the simulation's reports are not in reality ${SIMULATION_REALITY_ID}`,
          422,
        );
      }
      if (simulation.missing_fields.length > 0) {
        throw new ApiError(
          `Some of the simulation's reports are missing fields ENRICHED_REPORT requires: ${simulation.missing_fields.join(', ')}`,
          422,
        );
      }

      const run = await store.createRun(simulationId);
      launch(run);
      log.info(`[scheduler] Run ${run.id} started for simulation ${simulationId}`);
      return run;
    },

    /** Moves a started run to stopped and halts its dispatching. */
    async stopRun(simulationId: string, runId: string): Promise<SimulationRun> {
      const stopped = await store.stopRun(simulationId, runId);
      if (!stopped) {
        const run = await store.getRun(simulationId, runId);
        if (!run) throw new NotFoundError('Run not found');
        throw new ConflictError(`Run is not running (status: ${run.status})`);
      }
      const executor = executors.get(runId);
      executor?.abort();
      await executor?.finished;
      log.info(`[scheduler] Run ${runId} stopped after ${stopped.dispatched_count} reports`);
      return stopped;
    },

    async getRun(simulationId: string, runId: string): Promise<SimulationRun> {
      const run = await store.getRun(simulationId, runId);
      if (!run) throw new NotFoundError('Run not found');
      return run;
    },

    async listRuns(simulationId?: string) {
      return store.listRuns(simulationId);
    },

    async getStartedRun() {
      return store.getStartedRun();
    },

    /**
     * Call once at boot: fails runs that timed out while the backend was down,
     * resumes the other started runs from their saved progress, and starts the watchdog.
     */
    async recoverRuns(): Promise<number> {
      await failOverdueRuns();
      const runs = await store.listStartedRuns();
      for (const run of runs) launch(run);
      if (runs.length > 0) log.info(`[scheduler] Resumed ${runs.length} started run(s)`);

      watchdog ??= setInterval(() => {
        failOverdueRuns().catch((error) => log.error('[scheduler] Watchdog failed:', error));
      }, deps.watchdogIntervalS * 1000);
      watchdog.unref();
      return runs.length;
    },

    /** Halts all executors and leaves their runs started, so the next boot resumes them. */
    async shutdown(): Promise<void> {
      if (watchdog) clearInterval(watchdog);
      watchdog = null;
      const running = [...executors.values()];
      for (const executor of running) executor.abort();
      await Promise.allSettled(running.map((executor) => executor.finished));
    },

    /** Ids of runs dispatching in this process. */
    activeRunIds(): string[] {
      return [...executors.keys()];
    },
  };
}
