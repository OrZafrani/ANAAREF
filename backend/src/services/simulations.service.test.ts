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

import { createSimulation, listSimulations, updateSimulation } from './simulations.service.js';

describe('simulation service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(reportInsert).toContain('ON CONFLICT (reality_id, platform, report_url) DO UPDATE');
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
    expect(query).toContain('s.ai_generated AS "aiGenerated"');
  });

  it('updates a simulation and keeps its existing event report when editing', async () => {
    mockClient.query
      .mockReset()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({
        rows: [{ id: '123e4567-e89b-12d3-a456-426614174000', createdAt: '2026-10-20T07:00:00.000Z' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: '123' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ report_id: '123' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });

    const result = await updateSimulation('123e4567-e89b-12d3-a456-426614174000', {
      title: 'Updated simulation',
      description: 'Updated description',
      difficulty: 'קשה',
      sys: 'cm',
      events: [{
        id: '123',
        title: 'Updated event',
        category: 'מבצעי',
        minute: 7,
        description: 'Updated event description',
      }],
    });

    expect(result).toMatchObject({
      id: '123e4567-e89b-12d3-a456-426614174000',
      eventCount: 1,
    });
    expect(mockClient.query.mock.calls.map(([query]) => query.trim().split(/\s+/)[0])).toEqual([
      'BEGIN',
      'UPDATE',
      'SELECT',
      'DELETE',
      'UPDATE',
      'INSERT',
      'COMMIT',
    ]);
    expect(mockClient.query.mock.calls[1][1]).toEqual([
      '123e4567-e89b-12d3-a456-426614174000',
      'Updated simulation',
      'Updated description',
      'hard',
      45 * 60,
      'combat',
    ]);
    expect(mockClient.query.mock.calls[4][1]).toEqual([
      '123',
      'Updated event',
      'מבצעי',
      'Updated event description',
      'cobra-manual',
    ]);
    expect(mockClient.release).toHaveBeenCalledOnce();
  });

  it('reuses an orphaned simulation report when it is added back during editing', async () => {
    mockClient.query
      .mockReset()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({
        rows: [{ id: '123e4567-e89b-12d3-a456-426614174000', createdAt: '2026-10-20T07:00:00.000Z' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ report_id: '123' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });

    await updateSimulation('123e4567-e89b-12d3-a456-426614174000', {
      title: 'Updated simulation',
      description: '',
      difficulty: 'בינוני',
      events: [{
        id: 'template-id',
        title: 'Re-added event',
        category: 'מבצעי',
        minute: 4,
        description: 'Re-added event description',
      }],
    });

    const reportInsert = mockClient.query.mock.calls[4][0] as string;
    expect(reportInsert).toContain('ON CONFLICT (reality_id, platform, report_url) DO UPDATE');
    expect(mockClient.query.mock.calls[5][1]).toEqual([
      '123e4567-e89b-12d3-a456-426614174000',
      '123',
      4 * 60,
    ]);
    expect(mockClient.query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  });
});
