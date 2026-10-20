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
  });
});
