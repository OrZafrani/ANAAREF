import type { PoolClient } from 'pg';
import { db } from '../db.js';
import { ConflictError, NotFoundError } from '../lib/validate.js';

export interface CategoryTreeItem {
  id: string;
  name: string;
  report_count: number;
  sub_categories: Array<{
    id: string;
    category_id: string;
    name: string;
    report_count: number;
  }>;
}

export async function getCategoryTree(): Promise<CategoryTreeItem[]> {
  const result = await db.query<CategoryTreeItem>(`
    WITH sub_category_counts AS (
      SELECT s.id, s.category_id, s.name, COUNT(r.id)::int AS report_count
      FROM template_sub_categories s
      LEFT JOIN report_templates r ON r.sub_category_id = s.id
      GROUP BY s.id, s.category_id, s.name
    ), category_counts AS (
      SELECT c.id, c.name, COUNT(r.id)::int AS report_count
      FROM template_categories c
      LEFT JOIN report_templates r ON r.category_id = c.id
      GROUP BY c.id, c.name
    )
    SELECT c.id, c.name, c.report_count,
      COALESCE(
        json_agg(json_build_object(
          'id', s.id,
          'category_id', s.category_id,
          'name', s.name,
          'report_count', s.report_count
        ) ORDER BY s.name) FILTER (WHERE s.id IS NOT NULL),
        '[]'::json
      ) AS sub_categories
    FROM category_counts c
    LEFT JOIN sub_category_counts s ON s.category_id = c.id
    GROUP BY c.id, c.name, c.report_count
    ORDER BY c.name;
  `);
  return result.rows;
}

export async function createCategory(name: string) {
  const result = await db.query(
    'INSERT INTO template_categories (name) VALUES ($1) RETURNING id, name',
    [name],
  );
  return result.rows[0];
}

export async function renameCategory(id: string, name: string) {
  const result = await db.query(
    'UPDATE template_categories SET name = $2 WHERE id = $1 RETURNING id, name',
    [id, name],
  );
  if (result.rowCount === 0) throw new NotFoundError('Category not found');
  return result.rows[0];
}

export async function deleteCategory(id: string): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const category = await client.query(
      'SELECT id FROM template_categories WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (category.rowCount === 0) throw new NotFoundError('Category not found');

    const counts = await client.query<{ sub_category_count: number; report_count: number }>(`
      SELECT
        (SELECT COUNT(*)::int FROM template_sub_categories WHERE category_id = $1) AS sub_category_count,
        (SELECT COUNT(*)::int FROM report_templates WHERE category_id = $1) AS report_count
    `, [id]);
    const { sub_category_count: subCategoryCount, report_count: reportCount } = counts.rows[0];
    if (subCategoryCount > 0 || reportCount > 0) {
      throw new ConflictError(
        `Category contains ${subCategoryCount} sub-categories and ${reportCount} reports`,
      );
    }

    await client.query('DELETE FROM template_categories WHERE id = $1', [id]);
    await client.query('COMMIT');
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function createSubCategory(categoryId: string, name: string) {
  const result = await db.query(
    'INSERT INTO template_sub_categories (category_id, name) VALUES ($1, $2) RETURNING id, category_id, name',
    [categoryId, name],
  );
  return result.rows[0];
}

export async function listSubCategories(categoryId: string | null) {
  const result = await db.query(
    `SELECT s.id, s.category_id, s.name, COUNT(r.id)::int AS report_count
     FROM template_sub_categories s
     LEFT JOIN report_templates r ON r.sub_category_id = s.id
     WHERE ($1::uuid IS NULL OR s.category_id = $1)
     GROUP BY s.id, s.category_id, s.name
     ORDER BY s.name`,
    [categoryId],
  );
  return result.rows;
}

export async function updateSubCategory(
  id: string,
  update: { name: string | null; categoryId: string | null },
  expectedCategoryId?: string,
) {
  if (update.name === null && update.categoryId === null) {
    throw new ConflictError('Provide a name or category_id to update');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const currentResult = await client.query<{ category_id: string }>(
      'SELECT category_id FROM template_sub_categories WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (currentResult.rowCount === 0) throw new NotFoundError('Sub-category not found');

    const currentCategoryId = currentResult.rows[0].category_id;
    if (expectedCategoryId && currentCategoryId !== expectedCategoryId) {
      throw new NotFoundError('Sub-category not found under this category');
    }
    const nextCategoryId = update.categoryId ?? currentCategoryId;
    if (update.categoryId !== null) {
      const parent = await client.query('SELECT id FROM template_categories WHERE id = $1', [nextCategoryId]);
      if (parent.rowCount === 0) throw new NotFoundError('Target category not found');
    }

    const result = await client.query(
      `UPDATE template_sub_categories
       SET category_id = $2, name = COALESCE($3, name)
       WHERE id = $1
       RETURNING id, category_id, name`,
      [id, nextCategoryId, update.name],
    );

    if (nextCategoryId !== currentCategoryId) {
      await client.query(
        'UPDATE report_templates SET category_id = $2 WHERE sub_category_id = $1',
        [id, nextCategoryId],
      );
    }

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteSubCategory(id: string, expectedCategoryId?: string): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const subCategory = await client.query(
      'SELECT category_id FROM template_sub_categories WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (subCategory.rowCount === 0) throw new NotFoundError('Sub-category not found');
    if (expectedCategoryId && subCategory.rows[0].category_id !== expectedCategoryId) {
      throw new NotFoundError('Sub-category not found under this category');
    }

    const countResult = await client.query<{ report_count: number }>(
      'SELECT COUNT(*)::int AS report_count FROM report_templates WHERE sub_category_id = $1',
      [id],
    );
    if (countResult.rows[0].report_count > 0) {
      throw new ConflictError(`Sub-category contains ${countResult.rows[0].report_count} reports`);
    }

    await client.query('DELETE FROM template_sub_categories WHERE id = $1', [id]);
    await client.query('COMMIT');
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Preserve the original error if the transaction has already ended.
  }
}