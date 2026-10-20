import { db } from '../db.js';
import { NotFoundError } from '../lib/validate.js';

export interface TemplateFilters {
  categoryId: string | null;
  subCategoryId: string | null;
  search: string | null;
}

const TEMPLATE_COLUMNS = [
  'category_id', 'sub_category_id', 'schema_version', 'is_official', 'platform',
  'account_name', 'channel_name', 'report_url', 'report_title', 'original_language',
  'published_at', 'collected_at', 'original_content', 'translated_content',
  'threat_level', 'happened_at', 'country', 'city', 'lat', 'long',
  'red_injured_count', 'red_death_count', 'blue_injured_count', 'blue_death_count',
  'fastbreak_model_version',
] as const;

type TemplateColumn = typeof TEMPLATE_COLUMNS[number];
type TemplateValues = Partial<Record<TemplateColumn, unknown>>;

const TEMPLATE_SELECT = `
  SELECT t.*, c.name AS category_name, s.name AS sub_category_name
  FROM report_templates t
  JOIN template_categories c ON c.id = t.category_id
  LEFT JOIN template_sub_categories s ON s.id = t.sub_category_id
`;

export async function listTemplates(filters: TemplateFilters) {
  const result = await db.query(
    `${TEMPLATE_SELECT}
     WHERE ($1::uuid IS NULL OR t.category_id = $1)
       AND ($2::uuid IS NULL OR t.sub_category_id = $2)
       AND ($3::text IS NULL OR
            t.report_title ILIKE '%' || $3 || '%' OR
            t.original_content ILIKE '%' || $3 || '%' OR
            t.translated_content ILIKE '%' || $3 || '%' OR
            t.city ILIKE '%' || $3 || '%' OR
            c.name ILIKE '%' || $3 || '%' OR
            s.name ILIKE '%' || $3 || '%')
     ORDER BY t.collected_at DESC, t.id`,
    [filters.categoryId, filters.subCategoryId, filters.search],
  );
  return result.rows;
}

export async function getTemplate(id: string) {
  const result = await db.query(`${TEMPLATE_SELECT} WHERE t.id = $1`, [id]);
  if (result.rowCount === 0) throw new NotFoundError('Template not found');
  return result.rows[0];
}

export async function createTemplate(values: TemplateValues) {
  const columns = TEMPLATE_COLUMNS.filter((column) => Object.prototype.hasOwnProperty.call(values, column));
  const parameters = columns.map((column) => values[column]);
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const result = await db.query(
    `INSERT INTO report_templates (${columns.join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING *`,
    parameters,
  );
  return result.rows[0];
}

export async function updateTemplate(id: string, values: TemplateValues) {
  const columns = TEMPLATE_COLUMNS.filter((column) => Object.prototype.hasOwnProperty.call(values, column));
  const assignments = columns.map((column, index) => `${column} = $${index + 2}`);
  assignments.push('template_updated_at = (now() AT TIME ZONE \'utc\')');
  const parameters = columns.map((column) => values[column]);
  const result = await db.query(
    `UPDATE report_templates SET ${assignments.join(', ')}
     WHERE id = $1
     RETURNING *`,
    [id, ...parameters],
  );
  if (result.rowCount === 0) throw new NotFoundError('Template not found');
  return result.rows[0];
}

export async function deleteTemplate(id: string): Promise<void> {
  const result = await db.query('DELETE FROM report_templates WHERE id = $1', [id]);
  if (result.rowCount === 0) throw new NotFoundError('Template not found');
}