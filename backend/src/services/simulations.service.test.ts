import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockClient, mockDb } = vi.hoisted(() => {
  const client = {
    query: vi.fn(),
    release: vi.fn(),
  };
  return {
    mockClient: client,
    mockDb: {
      connect: vi.fn(),
      query: vi.fn(),
    },
  };
});

vi.mock('../db.js', () => ({ db: mockDb }));
vi.mock('xxhash-wasm', () => ({
  default: vi.fn(async () => ({ h64: vi.fn(() => 123n) })),
}));

import { createSimulation, listSimulations } from './simulations.service.js';
import { reportFields } from '../lib/reportFields.js';

function aiInput(offset = 197) {
  return {
    title: 'AI simulation', description: 'Custom duration', difficulty: 'בינוני', sys: 'spectre',
    ai_generated: true, length_s: 600,
    reports: [{
      client_id: 'd0000000-0000-4000-8000-000000000001',
      template_id: 'd0000000-0000-4000-8000-000000000002',
      category_name: 'חילוץ', dispatch_offset_s: offset,
      payload: {
        reality_id: 1, schema_version: 2, is_official: false, platform: 'telegram',
        report_url: 'https://example.invalid/library/report', report_title: 'Copied report',
        collected_at: '2026-10-20T07:00:00.000Z', published_at: null, happened_at: '2026-10-20T06:59:00.000Z',
        original_content: 'First line\nSecond line', translated_content: null,
        blue_injured_count: 0, red_injured_count: null, lat: 32.794, long: 34.9896,
        media_type: ['text', 'image'], categories: ['חילוץ', 'אחר'],
      },
    }],
  };
}

describe('simulation service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.query.mockReset();
    mockDb.connect.mockResolvedValue(mockClient);
    mockClient.query
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({
        rows: [{
          id: 'simulation-id',
          title: 'Simulation',
          difficulty: 'medium',
          createdAt: '2026-10-20T07:00:00.000Z',
        }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ report_id: '123' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
  });

  it('saves the simulation and its events using the current report schema', async () => {
    const result = await createSimulation({
      title: 'Simulation',
      description: 'Test description',
      difficulty: 'בינוני',
      sys: 'cm',
      events: [{
        id: 'template-id',
        title: 'Test event',
        category: 'מבצעי',
        minute: 5,
        description: 'Test event description',
      }],
    });

    expect(result).toMatchObject({ id: 'simulation-id', eventCount: 1 });
    expect(mockDb.connect).toHaveBeenCalledOnce();
    expect(mockClient.query.mock.calls.map(([query]) => query.trim().split(/\s+/)[0])).toEqual([
      'BEGIN',
      'INSERT',
      'INSERT',
      'INSERT',
      'COMMIT',
    ]);
    const reportInsert = mockClient.query.mock.calls[2][0] as string;
    expect(reportInsert).toContain('categories');
    expect(reportInsert).not.toContain('matches');
    expect(mockClient.query.mock.calls[2][1]).toContain('מבצעי');
    expect(mockClient.query.mock.calls[1][1]).toEqual([
      'Simulation',
      'Test description',
      'medium',
      30 * 60,
      'combat',
    ]);
    expect(mockClient.release).toHaveBeenCalledOnce();
  });

  it('reads saved event categories from the current report schema', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

    await expect(listSimulations()).resolves.toEqual([]);

    const query = mockDb.query.mock.calls[0][0] as string;
    expect(query).toContain('r.categories[1]');
    expect(query).not.toContain('r.matches');
    expect(query).toContain('ris.dispatch_offset_s / 60.0');
    expect(query).toContain('s.ai_generated AS "aiGenerated"');
    expect(query).toContain('s.length_s AS "lengthSeconds"');
  });

  it.each([0, 197, 600])('saves AI report copies with exact offset %i, custom duration, and complete data', async (offset) => {
    const input = aiInput(offset);
    await expect(createSimulation(input)).resolves.toMatchObject({ id: 'simulation-id', eventCount: 1 });
    expect(mockClient.query.mock.calls[1][0]).toContain('ai_generated');
    expect(mockClient.query.mock.calls[1][0]).toContain('$5, true');
    expect(mockClient.query.mock.calls[1][1]).toEqual(['AI simulation', 'Custom duration', 'medium', 600, 'specter']);
    const columns = ['report_id', 'reality_id', 'template_id', ...Object.keys(reportFields), 'media_type', 'categories'];
    const values = mockClient.query.mock.calls[2][1] as unknown[];
    const report = Object.fromEntries(columns.map((column, index) => [column, values[index]]));
    expect(report).toMatchObject({
      report_id: '123', reality_id: 1, template_id: input.reports[0].template_id,
      platform: 'telegram', report_title: 'Copied report', blue_injured_count: 0, red_injured_count: null,
      original_content: 'First line\nSecond line', translated_content: null,
      happened_at: '2026-10-20T06:59:00.000Z', lat: 32.794, long: 34.9896,
      media_type: ['text', 'image'], categories: ['חילוץ', 'אחר'],
    });
    expect(report.report_url).toBe(`https://cobra.invalid/simulations/simulation-id/events/${input.reports[0].client_id}`);
    expect(input.reports[0].payload.report_url).toBe('https://example.invalid/library/report');
    expect(mockClient.query.mock.calls[3][1]).toEqual(['simulation-id', '123', offset]);
    expect(mockClient.query.mock.calls[4][0]).toBe('COMMIT');
    expect(mockClient.release).toHaveBeenCalledOnce();
  });

  it.each([-1, 601, 1.5])('rejects invalid AI scheduling offset %s before connecting', async (offset) => {
    await expect(createSimulation(aiInput(offset))).rejects.toMatchObject({ statusCode: 400 });
    expect(mockDb.connect).not.toHaveBeenCalled();
  });

  it('saves a one-minute AI simulation and its endpoint offset', async () => {
    await expect(createSimulation({ ...aiInput(60), length_s: 60 })).resolves.toMatchObject({ eventCount: 1 });
    expect(mockClient.query.mock.calls[1][1]).toEqual(['AI simulation', 'Custom duration', 'medium', 60, 'specter']);
    expect(mockClient.query.mock.calls[3][1]).toEqual(['simulation-id', '123', 60]);
  });

  it.each([360, 1440])('batches all %i AI reports and links instead of querying per report', async (count) => {
    const input = aiInput();
    input.reports = Array.from({ length: count }, (_, index) => ({
      ...input.reports[0],
      client_id: `d0000000-0000-4000-8000-${index.toString().padStart(12, '0')}`,
      dispatch_offset_s: index % 601,
      payload: { ...input.reports[0].payload, report_title: `Report ${index}` },
    }));
    mockClient.query.mockReset().mockResolvedValue({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'simulation-id' }] });

    await expect(createSimulation(input)).resolves.toMatchObject({ eventCount: count });

    const columns = ['report_id', 'reality_id', 'template_id', ...Object.keys(reportFields), 'media_type', 'categories'];
    const batches = Math.ceil(count / 250);
    expect(mockClient.query).toHaveBeenCalledTimes(3 + batches * 2);
    for (let batch = 0; batch < batches; batch++) {
      const reports = input.reports.slice(batch * 250, (batch + 1) * 250);
      const [reportSql, reportValues] = mockClient.query.mock.calls[2 + batch * 2] as [string, unknown[]];
      const [linkSql, linkValues] = mockClient.query.mock.calls[3 + batch * 2] as [string, unknown[]];
      expect(reportValues).toHaveLength(reports.length * columns.length);
      expect(reportSql).toContain(`$${reportValues.length})`);
      expect(linkSql).toContain(`$${linkValues.length})`);
      expect(linkValues).toEqual(reports.flatMap((report) => ['simulation-id', '123', report.dispatch_offset_s]));
      reports.forEach((report, index) => {
        expect(reportValues[index * columns.length + columns.indexOf('report_title')]).toBe(report.payload.report_title);
        expect(reportValues[index * columns.length + columns.indexOf('report_url')]).toContain(report.client_id);
      });
    }
    expect(mockClient.query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
    expect(mockClient.release).toHaveBeenCalledOnce();
  });

  it('rolls back earlier batches if a later batch fails', async () => {
    const input = aiInput();
    input.reports = Array.from({ length: 251 }, (_, index) => ({
      ...input.reports[0], client_id: `d0000000-0000-4000-8000-${index.toString().padStart(12, '0')}`,
    }));
    const failure = new Error('later batch failed');
    mockClient.query.mockReset().mockResolvedValue({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'simulation-id' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(failure);
    await expect(createSimulation(input)).rejects.toBe(failure);
    expect(mockClient.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
    expect(mockClient.query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
    expect(mockClient.release).toHaveBeenCalledOnce();
  });

  it('validates report fields, synthetic reality, identities, report counts, and duration', async () => {
    const input = aiInput();
    const invalidInputs = [
      { ...input, length_s: 59 }, { ...input, length_s: 7201 }, { ...input, length_s: 600.5 },
      { ...input, reports: [] }, { ...input, reports: Array(1441).fill(input.reports[0]) },
      { ...input, reports: [input.reports[0], input.reports[0]] },
      ...[
        { client_id: 'bad' }, { template_id: 'bad' },
        { payload: { ...input.reports[0].payload, reality_id: 0 } },
        { payload: { ...input.reports[0].payload, lat: 91 } },
        { payload: { ...input.reports[0].payload, blue_injured_count: -1 } },
        { payload: { ...input.reports[0].payload, blue_injured_count: 2147483648 } },
        { payload: { ...input.reports[0].payload, collected_at: 'invalid' } },
        { payload: { ...input.reports[0].payload, report_url: 'javascript:invalid' } },
        { payload: { ...input.reports[0].payload, media_type: [false] } },
        { payload: { ...input.reports[0].payload, original_content: 'x'.repeat(50001) } },
      ].map((fields) => ({ ...input, reports: [{ ...input.reports[0], ...fields }] })),
    ];
    for (const invalid of invalidInputs) {
      await expect(createSimulation(invalid)).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(mockDb.connect).not.toHaveBeenCalled();
  });

  it('rolls back the complete save when any report insert fails', async () => {
    const failure = new Error('report insert failed');
    mockClient.query.mockReset()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'simulation-id' }] })
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ rows: [] });
    await expect(createSimulation(aiInput())).rejects.toBe(failure);
    expect(mockClient.query.mock.calls.map(([query]) => query.trim().split(/\s+/)[0])).toEqual([
      'BEGIN', 'INSERT', 'INSERT', 'ROLLBACK',
    ]);
    expect(mockClient.release).toHaveBeenCalledOnce();
  });
});
