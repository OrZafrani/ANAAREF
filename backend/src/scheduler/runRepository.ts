import { db } from '../db.js';
import { ConflictError } from '../lib/validate.js';
import type { Cursor, DispatchRow, RunStatus, SchedulerStore, SimulationForStart, SimulationRun, SimulationRunSummary } from './types.js';

const UTC_NOW = `(now() AT TIME ZONE 'utc')`;

// GREATEST keeps completed_at >= started_at (a CHECK) if the clock moved back.
const FINISH_SET = `status = $2, completed_at = GREATEST(${UTC_NOW}, started_at), failure_reason = $3`;

function isUniqueViolation(error: unknown, constraint: string): boolean {
  return typeof error === 'object' && error !== null
    && (error as { code?: string }).code === '23505'
    && (error as { constraint?: string }).constraint === constraint;
}

export const runRepository: SchedulerStore = {
  async getSimulationForStart(simulationId) {
    const result = await db.query<SimulationForStart>(
      `SELECT s.id, s.reality_id, s.target_system,
              count(ris.report_id)::int AS report_count,
              count(ris.report_id) FILTER (WHERE r.reality_id <> s.reality_id)::int AS other_reality_report_count
       FROM simulations s
       LEFT JOIN report_in_simulation ris ON ris.simulation_id = s.id
       LEFT JOIN reports r ON r.report_id = ris.report_id
       WHERE s.id = $1
       GROUP BY s.id`,
      [simulationId],
    );
    return result.rows[0] ?? null;
  },

  async createRun(simulationId) {
    try {
      const result = await db.query<SimulationRun>(
        `INSERT INTO simulation_runs (simulation_id) VALUES ($1) RETURNING *`,
        [simulationId],
      );
      return result.rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'simulation_runs_one_started_key')) {
        throw new ConflictError('Another simulation already has a started run');
      }
      throw error;
    }
  },

  async getRun(simulationId, runId) {
    const result = await db.query<SimulationRun>(
      `SELECT * FROM simulation_runs WHERE id = $1 AND simulation_id = $2`,
      [runId, simulationId],
    );
    return result.rows[0] ?? null;
  },

  async listRuns(simulationId) {
    const result = await db.query<SimulationRunSummary>(
      `SELECT r.*, s.name AS simulation_name, s.target_system, s.length_s AS simulation_length_s
       FROM simulation_runs r
       JOIN simulations s ON s.id = r.simulation_id
       WHERE ($1::uuid IS NULL OR r.simulation_id = $1)
       ORDER BY r.started_at DESC, r.id DESC`,
      [simulationId ?? null],
    );
    return result.rows;
  },

  async getStartedRun() {
    const result = await db.query<SimulationRunSummary>(
      `SELECT r.*, s.name AS simulation_name, s.target_system, s.length_s AS simulation_length_s
       FROM simulation_runs r
       JOIN simulations s ON s.id = r.simulation_id
       WHERE r.status = 'started'
       ORDER BY r.started_at DESC, r.id DESC
       LIMIT 1`,
    );
    return result.rows[0] ?? null;
  },

  async stopRun(simulationId, runId) {
    const result = await db.query<SimulationRun>(
      `UPDATE simulation_runs SET ${FINISH_SET}
       WHERE id = $1 AND status = 'started' AND simulation_id = $4
       RETURNING *`,
      [runId, 'stopped', null, simulationId],
    );
    return result.rows[0] ?? null;
  },

  async listStartedRuns() {
    const result = await db.query<SimulationRun>(
      `SELECT * FROM simulation_runs WHERE status = 'started' ORDER BY started_at`,
    );
    return result.rows;
  },

  async failOverdueRuns(graceS) {
    // Offsets may exceed length_s (it is not validated), so the deadline uses whichever is later.
    const result = await db.query<{ id: string }>(
      `UPDATE simulation_runs r
       SET status = 'failed',
           completed_at = GREATEST(${UTC_NOW}, r.started_at),
           failure_reason = 'Timed out: still running ' || $1::int || ' s after its length or last dispatch offset'
       FROM simulations s
       WHERE s.id = r.simulation_id
         AND r.status = 'started'
         AND r.started_at + make_interval(secs => $1::int + GREATEST(
               s.length_s,
               COALESCE((SELECT max(dispatch_offset_s) FROM report_in_simulation WHERE simulation_id = s.id), 0)
             )) < ${UTC_NOW}
       RETURNING r.id`,
      [graceS],
    );
    return result.rows.map((row) => row.id);
  },

  async fetchBatch(simulationId, after, limit) {
    // Keyset pagination: continue after the cursor. Served by the
    // (simulation_id, dispatch_offset_s, report_id) primary key index.
    const select = `
      SELECT ris.dispatch_offset_s, r.*
      FROM report_in_simulation ris
      JOIN reports r ON r.report_id = ris.report_id
      WHERE ris.simulation_id = $1`;
    const order = `ORDER BY ris.dispatch_offset_s, ris.report_id LIMIT $2`;
    const result = after === null
      ? await db.query<DispatchRow>(`${select} ${order}`, [simulationId, limit])
      : await db.query<DispatchRow>(
          `${select} AND (ris.dispatch_offset_s, ris.report_id) > ($3::int, $4::bigint) ${order}`,
          [simulationId, limit, after.offsetS, after.reportId],
        );
    return result.rows;
  },

  async getStatus(runId) {
    const result = await db.query<{ status: RunStatus }>(
      `SELECT status FROM simulation_runs WHERE id = $1`,
      [runId],
    );
    return result.rows[0]?.status ?? null;
  },

  async saveProgress(runId: string, cursor: Cursor, sentCount: number) {
    const result = await db.query(
      `UPDATE simulation_runs
       SET cursor_offset_s = $2, cursor_report_id = $3, dispatched_count = dispatched_count + $4
       WHERE id = $1 AND status = 'started'`,
      [runId, cursor.offsetS, cursor.reportId, sentCount],
    );
    return result.rowCount === 1;
  },

  async finishRun(runId, status, failureReason) {
    const result = await db.query<SimulationRun>(
      `UPDATE simulation_runs SET ${FINISH_SET}
       WHERE id = $1 AND status = 'started'
       RETURNING *`,
      [runId, status, failureReason ?? null],
    );
    return result.rows[0] ?? null;
  },
};
