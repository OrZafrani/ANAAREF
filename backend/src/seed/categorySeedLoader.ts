/**
 * Category Seed Loader
 *
 * Parses `reports_library_seed.csv` and upserts categories, sub-categories, and
 * report templates into PostgreSQL.  Designed to be:
 *   1. Idempotent  – safe to re-run without duplicating data
 *   2. Atomic      – entire load wrapped in a single transaction
 *   3. CLI-ready   – `npm run seed:library` (also called on boot when empty)
 *
 * Uses the `csv-parse` streaming parser and the `pg` Pool from `../db.ts`.
 */

import { createReadStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse';
import type { PoolClient } from 'pg';
import { db } from '../db.js';
import { vHttpUrl } from '../lib/validate.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, 'reports_library_seed.csv');

/**
 * Parse a casualty-count cell.
 *   ''   → null  (unknown)
 *   '0'  → 0     (confirmed zero)
 *   '5'  → 5
 */
export function parseCasualtyCount(val: string | undefined): number | null {
  if (val === undefined || val === null || val.trim() === '') return null;
  const parsed = parseInt(val.trim(), 10);
  if (isNaN(parsed)) return null;
  return parsed;
}

/**
 * Parse an optional ISO-8601 timestamp. Returns `null` when empty.
 */
export function parseOptionalTimestamp(val: string | undefined): string | null {
  if (!val || val.trim() === '') return null;
  return val.trim();
}

/**
 * Parse an optional numeric value (e.g. lat, long, threat_level).
 */
export function parseOptionalNumber(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  const n = Number(val.trim());
  return isNaN(n) ? null : n;
}

// ─── CSV Row type ─────────────────────────────────────────────────────────────

interface CsvRow {
  category: string;
  sub_category: string;
  schema_version: string;
  is_official: string;
  platform: string;
  account_name: string;
  channel_name: string;
  report_url: string;
  report_title: string;
  original_language: string;
  published_at: string;
  collected_at: string;
  original_content: string;
  translated_content: string;
  threat_level: string;
  happened_at: string;
  country: string;
  city: string;
  lat: string;
  long: string;
  red_injured_count: string;
  red_death_count: string;
  blue_injured_count: string;
  blue_death_count: string;
  fastbreak_model_version: string;
}

// ─── Upsert queries ──────────────────────────────────────────────────────────

const UPSERT_CATEGORY = `
  INSERT INTO template_categories (name)
  VALUES ($1)
  ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id;
`;

const UPSERT_SUB_CATEGORY = `
  INSERT INTO template_sub_categories (category_id, name)
  VALUES ($1, $2)
  ON CONFLICT (category_id, name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id;
`;

const UPSERT_REPORT_TEMPLATE = `
  INSERT INTO report_templates (
    category_id, sub_category_id, schema_version, is_official,
    platform, account_name, channel_name, report_url, report_title,
    original_language, published_at, collected_at,
    original_content, translated_content, threat_level,
    happened_at, country, city, lat, long,
    red_injured_count, red_death_count, blue_injured_count, blue_death_count,
    fastbreak_model_version
  ) VALUES (
    $1, $2, $3, $4,
    $5, $6, $7, $8, $9,
    $10, $11, $12,
    $13, $14, $15,
    $16, $17, $18, $19, $20,
    $21, $22, $23, $24,
    $25
  )
  ON CONFLICT (platform, report_url) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    sub_category_id = EXCLUDED.sub_category_id,
    schema_version = EXCLUDED.schema_version,
    is_official = EXCLUDED.is_official,
    account_name = EXCLUDED.account_name,
    channel_name = EXCLUDED.channel_name,
    report_title = EXCLUDED.report_title,
    original_language = EXCLUDED.original_language,
    published_at = EXCLUDED.published_at,
    collected_at = EXCLUDED.collected_at,
    original_content = EXCLUDED.original_content,
    translated_content = EXCLUDED.translated_content,
    threat_level = EXCLUDED.threat_level,
    happened_at = EXCLUDED.happened_at,
    country = EXCLUDED.country,
    city = EXCLUDED.city,
    lat = EXCLUDED.lat,
    long = EXCLUDED.long,
    red_injured_count = EXCLUDED.red_injured_count,
    red_death_count = EXCLUDED.red_death_count,
    blue_injured_count = EXCLUDED.blue_injured_count,
    blue_death_count = EXCLUDED.blue_death_count,
    fastbreak_model_version = EXCLUDED.fastbreak_model_version
  RETURNING id;
`;

// ─── Core loader ─────────────────────────────────────────────────────────────

async function readCsvRows(): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    const rows: CsvRow[] = [];
    createReadStream(CSV_PATH, { encoding: 'utf-8' })
      .pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: false,          // we handle trimming ourselves per field
          relax_column_count: true,
          quote: null,          // seed content contains literal `"` chars inside Hebrew fields
        }),
      )
      .on('data', (row: CsvRow) => rows.push(row))
      .on('error', reject)
      .on('end', () => resolve(rows));
  });
}

const validateReportUrl = vHttpUrl();

async function upsertRow(client: PoolClient, row: CsvRow): Promise<void> {
  // Same rule as the API: the UI renders report_url as a link, so only http(s) may be stored.
  const reportUrl = validateReportUrl(row.report_url);
  if (!reportUrl.ok) {
    throw new Error(`Seed row has an invalid report_url (${reportUrl.error}): ${String(row.report_url).slice(0, 200)}`);
  }

  // 1. Upsert category
  const catResult = await client.query(UPSERT_CATEGORY, [row.category.trim()]);
  const categoryId: string = catResult.rows[0].id;

  // 2. Upsert sub-category (if present)
  let subCategoryId: string | null = null;
  if (row.sub_category && row.sub_category.trim() !== '') {
    const subResult = await client.query(UPSERT_SUB_CATEGORY, [
      categoryId,
      row.sub_category.trim(),
    ]);
    subCategoryId = subResult.rows[0].id;
  }

  // 3. Upsert report template
  await client.query(UPSERT_REPORT_TEMPLATE, [
    categoryId,
    subCategoryId,
    parseInt(row.schema_version, 10),
    row.is_official.trim().toLowerCase() === 'true',
    row.platform.trim(),
    row.account_name?.trim() || null,
    row.channel_name?.trim() || null,
    reportUrl.value,
    row.report_title?.trim() || null,
    row.original_language?.trim() || null,
    parseOptionalTimestamp(row.published_at),
    row.collected_at.trim(),
    row.original_content,
    row.translated_content?.trim() || null,
    parseOptionalNumber(row.threat_level),
    parseOptionalTimestamp(row.happened_at),
    row.country?.trim() || null,
    row.city?.trim() || null,
    parseOptionalNumber(row.lat),
    parseOptionalNumber(row.long),
    parseCasualtyCount(row.red_injured_count),
    parseCasualtyCount(row.red_death_count),
    parseCasualtyCount(row.blue_injured_count),
    parseCasualtyCount(row.blue_death_count),
    row.fastbreak_model_version?.trim() || null,
  ]);
}

/**
 * Run the full seed: parse CSV → upsert all rows in a single transaction.
 * Returns a summary object.
 */
export async function runSeedLibrary(): Promise<{ rowCount: number }> {
  const rows = await readCsvRows();
  if (rows.length === 0) {
    console.log('[seed] CSV is empty – nothing to seed.');
    return { rowCount: 0 };
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      await upsertRow(client, row);
    }
    await client.query('COMMIT');
    console.log(`[seed] Seeded ${rows.length} report templates successfully.`);
    return { rowCount: rows.length };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed] Seed transaction rolled back:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Check whether the library is empty (used for auto-seed on boot).
 */
export async function isLibraryEmpty(): Promise<boolean> {
  const result = await db.query(
    'SELECT EXISTS (SELECT 1 FROM report_templates LIMIT 1) AS has_rows',
  );
  return !result.rows[0].has_rows;
}

// ─── CLI entry point ─────────────────────────────────────────────────────────
// Run directly: `npm run seed:library`  →  `tsx src/seed/categorySeedLoader.ts`

import dotenv from 'dotenv';

const isCli =
  process.argv[1] &&
  (process.argv[1].endsWith('categorySeedLoader.ts') ||
    process.argv[1].endsWith('categorySeedLoader.js'));

if (isCli) {
  dotenv.config({ path: join(__dirname, '..', '.env') });
  console.log('[seed] Running Category Seed Loader (CLI)...');
  runSeedLibrary()
    .then(({ rowCount }) => {
      console.log(`[seed] Done. ${rowCount} rows processed.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[seed] Fatal error:', err);
      process.exit(1);
    });
}
