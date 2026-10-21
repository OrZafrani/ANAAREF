import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportFields } from '../lib/reportFields.js';
import { convertReportCsv, getGeneration, startGeneration } from './ai-generation.service.js';

const input = {
  description: 'A fictional warehouse fire with evacuation and conflicting reports.',
  region: 'Fictional port', country: 'IL', area: { lat_min: 32.6, lat_max: 32.8, long_min: 34.9, long_max: 35.05 },
  length_s: 600, report_count: 2, noise_level: 'low',
};
const row: Record<string, string> = {
  schema_version: '1', is_official: 'False', platform: 'telegram', account_name: 'test',
  channel_name: 'Test channel', report_url: 'https://telegram.sim.invalid/test/1', report_title: '',
  original_language: 'he', published_at: '2026-10-20T12:00:00Z', collected_at: '2026-10-20T12:01:00Z',
  original_content: 'First line, "quoted"\nSecond line', translated_content: '', threat_level: '2',
  happened_at: '', country: 'IL', city: 'Fictional port', lat: '32.7', long: '34.95',
  red_injured_count: '', red_death_count: '', blue_injured_count: '0', blue_death_count: '3',
  fastbreak_model_version: 'chat-claude/table-v5', dispatch_offset_s: '60', matches: 'attack',
};
const headers = [...Object.keys(reportFields), 'dispatch_offset_s', 'matches'];
function csv(rows: Record<string, string>[] = [row, { ...row, dispatch_offset_s: '197', is_official: 'True' }]) {
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return '\uFEFF' + [headers.join(','), ...rows.map((item) => headers.map((key) => quote(item[key] ?? '')).join(','))].join('\r\n');
}
const completed = {
  status: 'completed',
  request: { scenario: { time_from: '2026-10-20T12:00:00Z', time_to: '2026-10-20T12:10:00Z', report_count: 2 } },
  result: { ok: true, check: { passed: true, warnings: ['A quality warning'] }, files: ['reports.csv'] },
};

describe('Cobra AI generation integration', () => {
  beforeEach(() => {
    vi.stubEnv('COBRA_API', 'http://cobra.test');
    vi.stubEnv('COBRA_API_TOKEN', 'test-only-token');
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('submits only supported custom scenario fields with backend authentication and a fresh seed', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ run_id: 'test-run-1', status: 'queued' }), { status: 202 }));
    await expect(startGeneration(input)).resolves.toEqual({ runId: 'test-run-1', status: 'queued' });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('http://cobra.test/runs');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-only-token' });
    const body = JSON.parse(String(init?.body));
    expect(body.scenario).toMatchObject({
      description: input.description, region: input.region, countries: ['IL'], area: input.area,
      noise_level: 'low', report_count: 2, formal_ratio: 40, arabic_ratio: 0,
    });
    expect(body.scenario.name).toMatch(/^cobra_ui_[a-f0-9]{20}$/);
    expect(Date.parse(body.scenario.time_to) - Date.parse(body.scenario.time_from)).toBe(600000);
    expect(Number.isInteger(body.seed)).toBe(true);
    expect(JSON.stringify(body)).not.toContain('test-only-token');
  });

  it.each([
    { report_count: 101 }, { report_count: 0 }, { length_s: 59 }, { description: 'short' },
    { noise_level: 'invalid' }, { country: 'Israel' },
    { area: { ...input.area, lat_max: 32 } }, { area: { ...input.area, long_min: -181 } },
  ])('rejects invalid settings before contacting the provider: %j', async (change) => {
    await expect(startGeneration({ ...input, ...change })).rejects.toMatchObject({ statusCode: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('converts quoted multiline CSV to entity payloads with exact types, offsets, and unknown counts', () => {
    const { reports, warnings } = convertReportCsv(csv(), 2, 600);
    expect(warnings).toEqual([]);
    expect(reports).toHaveLength(2);
    expect(reports[0]).toMatchObject({
      kind: 'unclassified', origin: 'ai', template_id: null, dispatch_offset_s: 60,
      payload: { reality_id: 1, schema_version: 1, is_official: false, report_title: null,
        original_content: 'First line, "quoted"\nSecond line', translated_content: null,
        threat_level: 2, lat: 32.7, long: 34.95, red_injured_count: null, blue_injured_count: 0, blue_death_count: 3 },
    });

    expect(reports[1].payload.is_official).toBe(true);
    expect(reports[0].payload).not.toHaveProperty('matches');
    expect(reports[0].client_id).not.toBe(reports[1].client_id);
    expect(reports[0].payload.report_url).toBe(row.report_url);
  });

  it.each([60, 7200])('accepts generation duration boundary %i seconds', async (length_s) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ run_id: 'boundary-run', status: 'queued' }), { status: 202 }));
    await expect(startGeneration({ ...input, length_s })).resolves.toMatchObject({ status: 'queued' });
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(Date.parse(body.scenario.time_to) - Date.parse(body.scenario.time_from)).toBe(length_s * 1000);
  });

  it('downloads and validates reports from a one-minute generation', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      ...completed, request: { scenario: { time_from: '2026-10-20T12:00:00Z', time_to: '2026-10-20T12:01:00Z', report_count: 1 } },
    }))).mockResolvedValueOnce(new Response(csv([row])));
    const result = await getGeneration('one-minute-run');
    expect(result.status).toBe('completed');
    expect(result.reports?.[0].dispatch_offset_s).toBe(60);
  });

  it.each<Record<string, string>>([
    { blue_death_count: 'unknown' }, { blue_death_count: '2.5' }, { blue_death_count: '2147483648' },
    { dispatch_offset_s: '' }, { dispatch_offset_s: '-1' }, { dispatch_offset_s: '601' },
    { is_official: 'yes' }, { lat: '91' }, { schema_version: '' }, { collected_at: 'invalid' },
  ])('excludes invalid CSV rows while retaining the valid row: %j', (change) => {
    const { reports, warnings } = convertReportCsv(csv([{ ...row, ...change }, row]), 2, 600);
    expect(reports).toHaveLength(1);
    expect(reports[0].payload.original_content).toBe(row.original_content);
    expect(warnings).toEqual([expect.stringContaining('1'), expect.stringContaining('row 1')]);
    expect(() => convertReportCsv(csv([{ ...row, ...change }]), 1, 600)).toThrow('no valid reports');
  });

  it('rejects missing/duplicate columns, bad quotes, empty files and excessive row counts', () => {
    expect(() => convertReportCsv('platform,platform\nx,x', 1, 600)).toThrow('columns');
    expect(() => convertReportCsv(csv() + '"', 2, 600)).toThrow();
    expect(() => convertReportCsv(csv(), 1, 600)).toThrow('count');
    expect(() => convertReportCsv(csv([]), 2, 600)).toThrow('no valid reports');
  });

  it('accepts a single valid row from a request for 100 reports without padding the result', () => {
    const { reports, warnings } = convertReportCsv(csv([row]), 100, 600);
    expect(reports).toHaveLength(1);
    expect(warnings).toEqual([expect.stringContaining('1 דיווחים תקינים מתוך 100')]);
  });

  it('preserves valid rows in chronological order without changing their offsets', () => {
    const { reports } = convertReportCsv(csv([
      { ...row, dispatch_offset_s: '197' }, { ...row, collected_at: 'invalid' }, { ...row, dispatch_offset_s: '0' },
    ]), 3, 600);
    expect(reports.map((report) => report.dispatch_offset_s)).toEqual([0, 197]);
  });

  it.each(['queued', 'running'])('polls %s without downloading a CSV', async (status) => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ status })));
    await expect(getGeneration('test-run')).resolves.toEqual({ runId: 'test-run', status });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('downloads CSV only after success and returns converted reports and quality warnings', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(completed))).mockResolvedValueOnce(new Response(csv()));
    const result = await getGeneration('test-run');
    expect(result).toMatchObject({ status: 'completed', warnings: ['A quality warning'] });
    expect(result.reports).toHaveLength(2);
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe('http://cobra.test/runs/test-run/files/reports.csv');
  });

  it('imports valid reports despite failed quality checks without requiring repair summary metadata', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      ...completed, result: { ...completed.result, ok: false, check: { passed: false, hard_failures: ['valid first call >= 90%'] } },
    }))).mockResolvedValueOnce(new Response(csv([row])));
    const result = await getGeneration('test-run');
    expect(result).toMatchObject({ status: 'completed', reports: [expect.objectContaining({ dispatch_offset_s: 60 })] });
    expect(result.warnings).toContainEqual(expect.stringContaining('90%'));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  const repairedSummary = { report_count: 2, rows_written: 2, rows_valid_first_call: 1, rows_repaired: 1, rows_schema_failed: 0 };
  function repairedResult(summary = repairedSummary, failures: unknown[] = ['valid first call >= 90%']) {
    return { ...completed, result: { ...completed.result, ok: false, summary,
      check: { passed: false, hard_failures: failures, warnings: ['Provider warning'] } } };
  }

  it('imports fully repaired rows with quality warnings', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(repairedResult())))
      .mockResolvedValueOnce(new Response(csv()));
    const result = await getGeneration('test-run');
    expect(result).toMatchObject({ status: 'completed' });
    expect(result.reports).toHaveLength(2);
    expect(result.warnings).toEqual([expect.stringContaining('90%'), 'Provider warning']);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    { summary: { ...repairedSummary, rows_schema_failed: 1 } },
    { summary: { ...repairedSummary, rows_written: 1 } },
    { summary: { ...repairedSummary, report_count: 3 } },
    { summary: { ...repairedSummary, rows_repaired: 0 } },
    { summary: { ...repairedSummary, rows_valid_first_call: -1 } },
    { summary: { ...repairedSummary, rows_valid_first_call: 2 } },
    { summary: { ...repairedSummary, rows_repaired: 0.5 } },
    { failures: ['valid first call >= 90%', 'another hard failure'] },
    { failures: ['another hard failure'] },
    { failures: ['valid first call >= 90%', null] },
  ])('validates CSV independently of quality failures or repair summary counts: %j', async ({ summary, failures }) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(repairedResult(summary, failures))))
      .mockResolvedValueOnce(new Response(csv([{ ...row, lat: '91' }, row])));
    const result = await getGeneration('test-run');
    expect(result.status).toBe('completed');
    expect(result.reports).toHaveLength(1);
    expect(result.warnings).toContainEqual(expect.stringContaining('row 1'));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('still rejects malformed CSV after failed quality checks', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(repairedResult())))
      .mockResolvedValueOnce(new Response(csv() + '"'));
    await expect(getGeneration('test-run')).rejects.toMatchObject({ statusCode: 502 });
  });

  it('fails when quality checks failed and no rows pass entity validation', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(repairedResult())))
      .mockResolvedValueOnce(new Response(csv([{ ...row, lat: '91' }])));
    await expect(getGeneration('test-run')).rejects.toThrow('no valid reports');
  });

  it.each([
    { request: { ...completed.request, scenario: { ...completed.request.scenario, report_count: 0 } } },
    { request: { ...completed.request, scenario: { ...completed.request.scenario, time_to: 'invalid' } } },
    { result: { ...completed.result, files: [] } },
  ])('rejects invalid job metadata or missing CSV before downloading: %j', async (change) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ ...completed, ...change })));
    await expect(getGeneration('test-run')).rejects.toMatchObject({ statusCode: 502 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('surfaces failed jobs, unsafe input, expired runs, connection failures, and missing configuration', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ status: 'failed', error: 'UnsafeScenarioError', issues: ['Use fictional locations'] })));
    await expect(getGeneration('test-run')).resolves.toMatchObject({ status: 'failed', error: expect.stringContaining('fictional') });
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ code: 'unsafe_scenario', message: 'Unsafe', issues: ['Rewrite'] }), { status: 400 }));
    await expect(startGeneration(input)).rejects.toMatchObject({ statusCode: 400, message: 'Unsafe Rewrite' });
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ code: 'run_not_found', message: 'Run expired' }), { status: 404 }));
    await expect(getGeneration('test-run')).rejects.toMatchObject({ statusCode: 404 });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Connection refused'));
    await expect(startGeneration(input)).rejects.toMatchObject({ statusCode: 503 });
    expect(log).toHaveBeenCalled();
    vi.stubEnv('COBRA_API_TOKEN', '');
    await expect(startGeneration(input)).rejects.toMatchObject({ statusCode: 503 });
  });
});
