import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDb, mockClient } = vi.hoisted(() => {
  const client = {
    query: vi.fn(),
    release: vi.fn(),
  };
  return {
    mockClient: client,
    mockDb: {
      query: vi.fn(),
      connect: vi.fn(),
    },
  };
});

vi.mock('../db.js', () => ({ db: mockDb }));

import { ConflictError } from '../lib/validate.js';
import { deleteCategory, getCategoryTree, updateSubCategory } from './categoryService.js';

describe('category service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.connect.mockResolvedValue(mockClient);
  });

  it('returns the category tree with aggregate report counts', async () => {
    const rows = [{
      id: 'category-id',
      name: 'Operations',
      report_count: 2,
      sub_categories: [{ id: 'sub-id', name: 'Alerts', report_count: 2 }],
    }];
    mockDb.query.mockResolvedValue({ rows });

    await expect(getCategoryTree()).resolves.toEqual(rows);
    expect(mockDb.query.mock.calls[0][0]).toContain('COUNT(r.id)::int');
    expect(mockDb.query.mock.calls[0][0]).toContain('ORDER BY c.name');
  });

  it('blocks category deletion when it contains sub-categories or reports', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rowCount: null, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'category-id' }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ sub_category_count: 1, report_count: 0 }],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(deleteCategory('category-id')).rejects.toBeInstanceOf(ConflictError);
    expect(mockClient.query).toHaveBeenNthCalledWith(4, 'ROLLBACK');
    expect(mockClient.release).toHaveBeenCalledOnce();
  });

  it('moves a sub-category and its reports in the same transaction', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rowCount: null, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ category_id: 'old-category' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'new-category' }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'sub-id', category_id: 'new-category', name: 'Alerts' }],
      })
      .mockResolvedValueOnce({ rowCount: 3, rows: [] })
      .mockResolvedValueOnce({ rowCount: null, rows: [] });

    await expect(updateSubCategory('sub-id', {
      name: null,
      categoryId: 'new-category',
    })).resolves.toEqual({ id: 'sub-id', category_id: 'new-category', name: 'Alerts' });

    expect(mockClient.query.mock.calls[0][0]).toBe('BEGIN');
    expect(mockClient.query.mock.calls[4]).toEqual([
      'UPDATE report_templates SET category_id = $2 WHERE sub_category_id = $1',
      ['sub-id', 'new-category'],
    ]);
    expect(mockClient.query.mock.calls[5][0]).toBe('COMMIT');
    expect(mockClient.release).toHaveBeenCalledOnce();
  });
});
