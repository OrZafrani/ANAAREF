import { db } from '../db.js';
import { NotFoundError } from '../lib/validate.js';

export interface ReportFilters {
  categoryId: string | null;
  subCategoryId: string | null;
  search: string | null;
}

export async function listLibraryReports(filters: ReportFilters) {
  const result = await db.query(
    `SELECT id, category_id, sub_category_id, platform, account_name, channel_name,
            report_url, report_title, original_language, published_at,
            collected_at, threat_level, country, city,
            red_injured_count, red_death_count, blue_injured_count, blue_death_count
     FROM report_templates
     WHERE ($1::uuid IS NULL OR category_id = $1)
       AND ($2::uuid IS NULL OR sub_category_id = $2)
       AND ($3::text IS NULL OR
            report_title ILIKE '%' || $3 || '%' OR
            original_content ILIKE '%' || $3 || '%' OR
            translated_content ILIKE '%' || $3 || '%' OR
            city ILIKE '%' || $3 || '%')
     ORDER BY collected_at DESC, id`,
    [filters.categoryId, filters.subCategoryId, filters.search],
  );
  return result.rows;
}

export async function getLibraryReport(id: string) {
  const result = await db.query('SELECT * FROM report_templates WHERE id = $1', [id]);
  if (result.rowCount === 0) throw new NotFoundError('Report template not found');
  return result.rows[0];
}