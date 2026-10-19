import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDb } = vi.hoisted(() => ({ mockDb: { query: vi.fn() } }));

vi.mock('../db.js', () => ({ db: mockDb }));

import { updateTemplate } from './templateService.js';

describe('template service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('parameterizes template fields and updates the UTC updated timestamp', async () => {
    const injectedText = "sample'; DROP TABLE report_templates; --";
    const updated = { id: 'template-id', report_title: injectedText };
    mockDb.query.mockResolvedValue({ rowCount: 1, rows: [updated] });

    await expect(updateTemplate('template-id', { report_title: injectedText })).resolves.toEqual(updated);

    const [sql, values] = mockDb.query.mock.calls[0];
    expect(sql).toContain('template_updated_at = (now() AT TIME ZONE');
    expect(sql).not.toContain(injectedText);
    expect(values).toEqual(['template-id', injectedText]);
  });
});
