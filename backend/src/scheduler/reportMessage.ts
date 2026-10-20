import type { DispatchRow, EnrichedReport, KafkaMessage } from './types.js';

/** Cobra publishes only into the default simulated reality. Never 0 (the real world). */
export const SIMULATION_REALITY_ID = 1;

const BIGINT_RE = /^-?\d+$/;

/** UTC ISO 8601 with milliseconds, e.g. "2026-10-19T14:58:00.000Z", as in Specter's example. */
export function formatTimestamp(time: Date): string {
  return time.toISOString();
}

/**
 * Builds the reports.enriched message for one report, sent at `sentAt`, in the
 * format of the Specter team's example (shared/contracts/specter_enriched_report.example.json).
 *
 * Timestamps are moved to the present: collected_at becomes `sentAt`, and
 * published_at / happened_at shift by the same amount, so the gaps between
 * them stay as stored. The stored report is not changed.
 */
export function buildReportMessage(row: DispatchRow, sentAt: Date): KafkaMessage {
  if (row.reality_id !== SIMULATION_REALITY_ID) {
    throw new Error(`Report ${row.report_id} is in reality ${row.reality_id}; only reality ${SIMULATION_REALITY_ID} can be dispatched`);
  }
  if (!BIGINT_RE.test(row.report_id)) {
    throw new Error(`Invalid report_id "${row.report_id}"`);
  }

  const shiftMs = sentAt.getTime() - row.collected_at.getTime();
  const shift = (time: Date | null) => (time === null ? null : formatTimestamp(new Date(time.getTime() + shiftMs)));

  const report: EnrichedReport = {
    // A string: Specter's example uses one, and it keeps 64-bit ids exact for JS consumers.
    report_id: row.report_id,
    reality_id: SIMULATION_REALITY_ID,
    schema_version: row.schema_version,
    is_official: row.is_official,
    platform: row.platform,
    account_name: row.account_name,
    channel_name: row.channel_name,
    report_url: row.report_url,
    report_title: row.report_title,
    original_language: row.original_language,
    // Migration 0009 removed the matches column, so there are no trigger keywords to send.
    matches: [],
    categories: row.categories,
    published_at: shift(row.published_at),
    collected_at: formatTimestamp(sentAt),
    original_content: row.original_content,
    // NULL when the report is already in the target language, as in Specter's example.
    translated_content: row.translated_content,
    threat_level: row.threat_level,
    country: row.country,
    city: row.city,
    lat: row.lat,
    long: row.long,
    happened_at: shift(row.happened_at),
    // NULL = unknown, 0 = reported zero. Passed through as is.
    red_injured_count: row.red_injured_count,
    red_death_count: row.red_death_count,
    blue_injured_count: row.blue_injured_count,
    blue_death_count: row.blue_death_count,
    fastbreak_model_version: row.fastbreak_model_version,
  };

  return {
    key: `${SIMULATION_REALITY_ID}:${row.report_id}`,
    value: JSON.stringify(report),
  };
}
