import { describe, expect, it } from 'vitest';
import { buildReportMessage } from './reportMessage.js';
import { dispatchRow } from './testFixtures.js';

const sentAt = new Date('2026-10-25T10:00:00.000Z');

describe('buildReportMessage', () => {
  it('keys the message by reality and report and publishes reality 1', () => {
    const message = buildReportMessage(dispatchRow({ report_id: '1001' }), sentAt);
    expect(message.key).toBe('1:1001');
    expect(JSON.parse(message.value).reality_id).toBe(1);
  });

  it('writes a 64-bit report_id as an exact JSON number', () => {
    const reportId = '-7349681472939273501'; // beyond Number.MAX_SAFE_INTEGER
    const { value } = buildReportMessage(dispatchRow({ report_id: reportId }), sentAt);
    expect(value.startsWith(`{"report_id":${reportId},"reality_id":1,`)).toBe(true);
    expect(() => JSON.parse(value)).not.toThrow();
  });

  it('moves timestamps to the send time and keeps the gaps between them', () => {
    const report = JSON.parse(buildReportMessage(dispatchRow(), sentAt).value);
    // Stored: happened 08:15:00, published 08:30:00, collected 08:31:12.
    expect(report.collected_at).toBe('2026-10-25T10:00:00.000Z');
    expect(report.published_at).toBe('2026-10-25T09:58:48.000Z');
    expect(report.happened_at).toBe('2026-10-25T09:43:48.000Z');
  });

  it('keeps NULL timestamps NULL', () => {
    const report = JSON.parse(buildReportMessage(dispatchRow({ published_at: null, happened_at: null }), sentAt).value);
    expect(report.published_at).toBeNull();
    expect(report.happened_at).toBeNull();
  });

  it('keeps unknown (NULL) and zero casualty counts apart', () => {
    const report = JSON.parse(buildReportMessage(dispatchRow({
      red_injured_count: 0, red_death_count: 3, blue_injured_count: null, blue_death_count: null,
    }), sentAt).value);
    expect(report.red_injured_count).toBe(0);
    expect(report.red_death_count).toBe(3);
    expect(report.blue_injured_count).toBeNull();
    expect(report.blue_death_count).toBeNull();
  });

  it('includes exactly the ENRICHED_REPORT fields', () => {
    const report = JSON.parse(buildReportMessage(dispatchRow(), sentAt).value);
    expect(Object.keys(report)).toEqual([
      'report_id', 'reality_id', 'schema_version', 'is_official', 'platform', 'account_name',
      'channel_name', 'report_url', 'report_title', 'original_language', 'matches', 'published_at',
      'collected_at', 'original_content', 'translated_content', 'threat_level', 'country', 'city',
      'lat', 'long', 'happened_at', 'red_injured_count', 'red_death_count', 'blue_injured_count',
      'blue_death_count', 'fastbreak_model_version',
    ]);
  });

  it('refuses reports outside reality 1', () => {
    expect(() => buildReportMessage(dispatchRow({ reality_id: 0 }), sentAt)).toThrow(/reality 0/);
  });
});
