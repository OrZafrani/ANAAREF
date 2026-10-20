import type { DispatchRow } from './types.js';

/** A dispatchable report row with sensible defaults, for tests. */
export function dispatchRow(overrides: Partial<DispatchRow> = {}): DispatchRow {
  return {
    dispatch_offset_s: 0,
    report_id: '1001',
    reality_id: 1,
    schema_version: 1,
    is_official: true,
    platform: 'telegram',
    account_name: 'news_feed_intel',
    channel_name: 'IntelDesk',
    report_url: 'https://t.me/news_feed_intel/10492',
    media_type: ['text'],
    report_title: 'Incident reported in district 4',
    original_language: 'ar',
    matches: ['alert', 'strike'],
    categories: ['security'],
    published_at: new Date('2026-10-15T08:30:00.000Z'),
    happened_at: new Date('2026-10-15T08:15:00.000Z'),
    collected_at: new Date('2026-10-15T08:31:12.000Z'),
    original_content: 'original',
    translated_content: 'translated',
    threat_level: 40,
    country: 'IL',
    city: 'Tel Aviv',
    lat: 32.0853,
    long: 34.7818,
    red_injured_count: 0,
    red_death_count: 0,
    blue_injured_count: null,
    blue_death_count: null,
    fastbreak_model_version: 'fastbreak-v2.4.1',
    ...overrides,
  };
}
