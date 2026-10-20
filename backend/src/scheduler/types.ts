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

/** The fields startRun checks before it creates a run. */
export interface SimulationForStart {
  id: string;
  reality_id: number;
  target_system: 'specter' | 'combat';
  report_count: number;
  other_reality_report_count: number;
  /** Required ENRICHED_REPORT fields that are empty in at least one of the simulation's reports. */
  missing_fields: string[];
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
  media_type: string[];
  report_title: string | null;
  original_language: string | null;
  matches: string[] | null;
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
 * ENRICHED_REPORT as published to reports.enriched, matching the DE team's
 * shared/contracts/enriched_report.py field for field. Timestamps are UTC "YYYY-MM-DD HH:MM".
 */
export interface EnrichedReport {
  report_id: string;
  reality_id: number;
  schema_version: number;
  is_official: boolean;
  platform: string;
  account_name: string;
  channel_name: string;
  report_url: string;
  media_type: string[];
  report_title: string | null;
  original_language: string;
  matches: string[];
  categories: string[];
  published_at: string | null;
  collected_at: string;
  original_content: string;
  translated_content: string;
  threat_level: number;
  country: string;
  city: string;
  lat: number;
  long: number;
  happened_at: string | null;
  red_injured_count: number | null;
  red_death_count: number | null;
  blue_injured_count: number | null;
  blue_death_count: number | null;
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
  stopRun(simulationId: string, runId: string): Promise<SimulationRun | null>;
  listStartedRuns(): Promise<SimulationRun[]>;
  /** Fails started runs past their length (or last offset) plus the grace. Returns their ids. */
  failOverdueRuns(graceS: number): Promise<string[]>;
}

export type Logger = Pick<Console, 'info' | 'warn' | 'error'>;
