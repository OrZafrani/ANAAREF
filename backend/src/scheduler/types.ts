export type RunStatus = 'started' | 'completed' | 'stopped' | 'failed';

/** Position of the last report Kafka confirmed, in (dispatch_offset_s, report_id) order. */
export interface Cursor {
  offsetS: number;
  reportId: string;
}

/** A simulation_runs row. bigint columns come back from pg as strings. */
export interface SimulationRun {
  id: string;
  simulation_id: string;
  started_at: Date;
  completed_at: Date | null;
  status: RunStatus;
  cursor_offset_s: number | null;
  cursor_report_id: string | null;
  dispatched_count: number;
  failure_reason: string | null;
}

/** A run joined with the simulation details needed by dashboards. */
export interface SimulationRunSummary extends SimulationRun {
  simulation_name: string;
  target_system: 'specter' | 'combat';
  simulation_length_s: number;
  /** Reports the run will send in total; with dispatched_count it gives the run's progress. */
  report_count: number;
}

/** The fields startRun checks before it creates a run. */
export interface SimulationForStart {
  id: string;
  reality_id: number;
  target_system: 'specter' | 'combat';
  report_count: number;
  other_reality_report_count: number;
}

/** A report_in_simulation row joined with its report. */
export interface DispatchRow {
  dispatch_offset_s: number;
  report_id: string;
  reality_id: number;
  schema_version: number;
  is_official: boolean;
  platform: string;
  account_name: string | null;
  channel_name: string | null;
  report_url: string;
  report_title: string | null;
  original_language: string | null;
  categories: string[];
  published_at: Date | null;
  happened_at: Date | null;
  collected_at: Date;
  original_content: string;
  translated_content: string | null;
  threat_level: number | null;
  country: string | null;
  city: string | null;
  lat: number | null;
  long: number | null;
  red_injured_count: number | null;
  red_death_count: number | null;
  blue_injured_count: number | null;
  blue_death_count: number | null;
  fastbreak_model_version: string | null;
}

/**
 * ENRICHED_REPORT as published to reports.enriched, field for field as in the Specter
 * team's example (shared/contracts/specter_enriched_report.example.json).
 * Timestamps are UTC ISO 8601, e.g. "2026-10-19T14:58:00.000Z".
 */
export interface EnrichedReport {
  report_id: string;
  reality_id: number;
  schema_version: number;
  is_official: boolean;
  platform: string;
  account_name: string | null;
  channel_name: string | null;
  report_url: string;
  report_title: string | null;
  original_language: string | null;
  matches: string[];
  categories: string[];
  published_at: string | null;
  collected_at: string;
  original_content: string;
  translated_content: string | null;
  threat_level: number | null;
  country: string | null;
  city: string | null;
  lat: number | null;
  long: number | null;
  happened_at: string | null;
  red_injured_count: number | null;
  red_death_count: number | null;
  blue_injured_count: number | null;
  blue_death_count: number | null;
  fastbreak_model_version: string | null;
}

export interface KafkaMessage {
  key: string;
  value: string;
}

export interface ReportPublisher {
  /** Resolves once Kafka has confirmed every message. */
  send(messages: KafkaMessage[]): Promise<void>;
}

/** The queries one run's executor needs. */
export interface RunStore {
  fetchBatch(simulationId: string, after: Cursor | null, limit: number): Promise<DispatchRow[]>;
  getStatus(runId: string): Promise<RunStatus | null>;
  /** Returns false if the run is no longer started. */
  saveProgress(runId: string, cursor: Cursor, sentCount: number): Promise<boolean>;
  /** Moves a started run to a final status. Returns null if it was no longer started. */
  finishRun(runId: string, status: Exclude<RunStatus, 'started'>, failureReason?: string): Promise<SimulationRun | null>;
}

/** Everything the scheduler needs from the database. */
export interface SchedulerStore extends RunStore {
  getSimulationForStart(simulationId: string): Promise<SimulationForStart | null>;
  /** Throws ConflictError if the simulation already has a started run. */
  createRun(simulationId: string): Promise<SimulationRun>;
  getRun(simulationId: string, runId: string): Promise<SimulationRun | null>;
  listRuns(simulationId?: string): Promise<SimulationRunSummary[]>;
  getStartedRun(): Promise<SimulationRunSummary | null>;
  stopRun(simulationId: string, runId: string): Promise<SimulationRun | null>;
  listStartedRuns(): Promise<SimulationRun[]>;
  /** Fails started runs past their length (or last offset) plus the grace. Returns their ids. */
  failOverdueRuns(graceS: number): Promise<string[]>;
}

export type Logger = Pick<Console, 'info' | 'warn' | 'error'>;
