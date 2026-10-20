import { describe, expect, it } from 'vitest';
import { buildReportMessage, formatTimestamp, missingRequiredFields } from './reportMessage.js';
import { dispatchRow } from './testFixtures.js';

const sentAt = new Date('2026-10-25T10:00:00.000Z');
const parse = (value: string) => JSON.parse(value);

describe('buildReportMessage', () => {
  it('keys the message by reality and report and publishes reality 1', () => {
    const message = buildReportMessage(dispatchRow({ report_id: '1001' }), sentAt);
    expect(message.key).toBe('1:1001');
    expect(parse(message.value).reality_id).toBe(1);
  });

  it('writes a 64-bit report_id as an exact JSON number', () => {
    const reportId = '-7349681472939273501'; // beyond Number.MAX_SAFE_INTEGER
    const { value } = buildReportMessage(dispatchRow({ report_id: reportId }), sentAt);
    expect(value.startsWith(`{"report_id":${reportId},"reality_id":1,`)).toBe(true);
    expect(() => parse(value)).not.toThrow();
  });

  it('moves timestamps to the send time and keeps the gaps between them', () => {
    const report = parse(buildReportMessage(dispatchRow(), sentAt).value);
    // Stored: happened 08:15:00, published 08:30:00, collected 08:31:12.
    // Shifted: 09:43:48, 09:58:48, 10:00:00, written to the minute.
    expect(report.collected_at).toBe('2026-10-25 10:00');
    expect(report.published_at).toBe('2026-10-25 09:58');
    expect(report.happened_at).toBe('2026-10-25 09:43');
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

  it('sends media_type and categories, and not fastbreak_model_version', () => {
    const report = parse(buildReportMessage(dispatchRow({ media_type: ['text', 'photo'], categories: ['security'] }), sentAt).value);
    expect(report.media_type).toEqual(['text', 'photo']);
    expect(report.categories).toEqual(['security']);
    expect(report).not.toHaveProperty('fastbreak_model_version');
  });

  it('uses the original text as the translation when the report is already in Hebrew', () => {
    const report = parse(buildReportMessage(
      dispatchRow({ original_language: 'he', original_content: 'דיווח', translated_content: null }),
      sentAt,
    ).value);
    expect(report.translated_content).toBe('דיווח');
  });

  it('refuses reports outside reality 1', () => {
    expect(() => buildReportMessage(dispatchRow({ reality_id: 0 }), sentAt)).toThrow(/reality 0/);
  });

  it('refuses reports missing a field the contract requires', () => {
    expect(() => buildReportMessage(dispatchRow({ city: null, lat: null }), sentAt))
      .toThrow('missing fields ENRICHED_REPORT requires: city, lat');
  });
});

describe('missingRequiredFields', () => {
  it('requires a translation only for reports not already in Hebrew', () => {
    expect(missingRequiredFields(dispatchRow({ original_language: 'ar', translated_content: null })))
      .toEqual(['translated_content']);
    expect(missingRequiredFields(dispatchRow({ original_language: 'he', translated_content: null }))).toEqual([]);
  });
});

describe('formatTimestamp', () => {
  it('writes UTC to the minute', () => {
    expect(formatTimestamp(new Date('2026-10-19T10:00:59.999Z'))).toBe('2026-10-19 10:00');
  });
});
