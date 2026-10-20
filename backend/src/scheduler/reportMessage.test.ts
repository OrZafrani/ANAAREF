import { describe, expect, it } from 'vitest';
import { buildReportMessage } from './reportMessage.js';
import { dispatchRow } from './testFixtures.js';

const sentAt = new Date('2026-10-25T10:00:00.000Z');
const parse = (value: string) => JSON.parse(value);

describe('buildReportMessage', () => {
  it('keys the message by reality and report and publishes reality 1', () => {
    const message = buildReportMessage(dispatchRow({ report_id: '1001' }), sentAt);
    expect(message.key).toBe('1:1001');
    expect(parse(message.value).reality_id).toBe(1);
  });

  it('sends report_id as a string, exact even beyond JS number precision', () => {
    const reportId = '-7349681472939273501';
    const report = parse(buildReportMessage(dispatchRow({ report_id: reportId }), sentAt).value);
    expect(report.report_id).toBe(reportId);
  });

  it('moves timestamps to the send time, in ISO 8601, keeping the gaps between them', () => {
    const report = parse(buildReportMessage(dispatchRow(), sentAt).value);
    // Stored: happened 08:15:00, published 08:30:00, collected 08:31:12.
    expect(report.collected_at).toBe('2026-10-25T10:00:00.000Z');
    expect(report.published_at).toBe('2026-10-25T09:58:48.000Z');
    expect(report.happened_at).toBe('2026-10-25T09:43:48.000Z');
  });

  it('keeps NULL timestamps NULL', () => {
    const report = parse(buildReportMessage(dispatchRow({ published_at: null, happened_at: null }), sentAt).value);
    expect(report.published_at).toBeNull();
    expect(report.happened_at).toBeNull();
  });

  it('keeps unknown (NULL) and zero casualty counts apart', () => {
    const report = parse(buildReportMessage(dispatchRow({
      red_injured_count: 0, red_death_count: 3, blue_injured_count: null, blue_death_count: null,
    }), sentAt).value);
    expect(report.red_injured_count).toBe(0);
    expect(report.red_death_count).toBe(3);
    expect(report.blue_injured_count).toBeNull();
    expect(report.blue_death_count).toBeNull();
  });

  it('sends a NULL translation as NULL', () => {
    const report = parse(buildReportMessage(dispatchRow({ original_language: 'he', translated_content: null }), sentAt).value);
    expect(report.translated_content).toBeNull();
  });

  it('sends categories and fastbreak_model_version, an empty matches list, and no media_type', () => {
    const report = parse(buildReportMessage(dispatchRow({ categories: ['כלי טיס עוין', 'ירי תלול מסלול'] }), sentAt).value);
    expect(report.categories).toEqual(['כלי טיס עוין', 'ירי תלול מסלול']);
    expect(report.fastbreak_model_version).toBe('fastbreak-v2.4.1');
    expect(report.matches).toEqual([]);
    expect(report).not.toHaveProperty('media_type');
  });

  it('sends reports with empty optional fields', () => {
    // As written by the simulations API: no account, channel, threat level or location.
    const report = parse(buildReportMessage(dispatchRow({
      account_name: null, channel_name: null, threat_level: null, country: null, city: null, lat: null, long: null,
    }), sentAt).value);
    expect(report).toMatchObject({ account_name: null, city: null, lat: null, threat_level: null });
  });

  it('refuses reports outside reality 1', () => {
    expect(() => buildReportMessage(dispatchRow({ reality_id: 0 }), sentAt)).toThrow(/reality 0/);
  });
});
