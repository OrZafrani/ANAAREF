import type { PoolClient } from 'pg';
import xxhash from 'xxhash-wasm';
import { db } from '../db.js';
import { ApiError } from './api-error.js';
import { reportFields } from '../lib/reportFields.js';
import { vStringArray } from '../lib/validate.js';

const xxhashPromise = xxhash();
const REALITY_ID = 1;
const REPORT_PLATFORM = 'cobra-manual';
const EVENT_CATEGORIES = new Set(['מבצעי', 'התראה', 'תקלה', 'חירום', 'תקשורת']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AI_REPORT_BATCH_SIZE = 250;

interface SimulationEventInput {
  id: string;
  title: string;
  category: string;
  minute: number;
  description: string;
}

interface AiReportInput {
  client_id: string;
  template_id: string | null;
  dispatch_offset_s: number;
  category_name: string;
  payload: Record<string, unknown>;
}

interface CreateSimulationInput {
  title: string;
  description: string | null;
  difficulty: keyof typeof DIFFICULTY_SETTINGS;
  sys: 'spectre' | 'cm';
  events: SimulationEventInput[];
  aiReports?: AiReportInput[];
  lengthSeconds: number;
}

const DIFFICULTY_SETTINGS = {
  קל: { databaseValue: 'easy', lengthSeconds: 20 * 60 },
  בינוני: { databaseValue: 'medium', lengthSeconds: 30 * 60 },
  קשה: { databaseValue: 'hard', lengthSeconds: 45 * 60 },
} as const;

const SIMULATION_SELECT = `
  SELECT s.id,
         s.name AS title,
         s.description,
         CASE s.difficulty::text
           WHEN 'easy' THEN 'קל'
           WHEN 'medium' THEN 'בינוני'
           WHEN 'hard' THEN 'קשה'
           ELSE s.difficulty::text
         END AS difficulty,
         CASE s.target_system::text
           WHEN 'specter' THEN 'spectre'
           WHEN 'combat' THEN 'cm'
         END AS sys,
         s.created_at AS "createdAt",
         s.ai_generated AS "aiGenerated",
         s.length_s AS "lengthSeconds",
         COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id', ris.report_id::text,
               'title', r.report_title,
               'category', COALESCE(
                 r.categories[1],
                 substring(r.original_content FROM E'^סיווג: ([^\\n]*)'),
                 'מבצעי'
               ),
               'minute', ris.dispatch_offset_s / 60.0,
               'description', regexp_replace(
                 r.original_content,
                 E'^סיווג: [^\\n]*\\n\\n',
                 ''
               )
             ) ORDER BY ris.dispatch_offset_s
           ) FILTER (WHERE ris.report_id IS NOT NULL),
           '[]'::jsonb
         ) AS events
    FROM simulations s
    LEFT JOIN report_in_simulation ris ON ris.simulation_id = s.id
    LEFT JOIN reports r ON r.report_id = ris.report_id
`;

function validateEvent(value: unknown): value is SimulationEventInput {
  if (typeof value !== 'object' || value === null) return false;

  const event = value as Record<string, unknown>;
  return (
    typeof event.id === 'string' && event.id.trim().length > 0 &&
    typeof event.title === 'string' && event.title.trim().length > 0 &&
    typeof event.category === 'string' && EVENT_CATEGORIES.has(event.category) &&
    typeof event.minute === 'number' && Number.isInteger(event.minute) && event.minute >= 1 &&
    typeof event.description === 'string' && event.description.trim().length > 0
  );
}

function validateCreateInput(value: unknown): CreateSimulationInput {
  const input = typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {};

  if (typeof input.title !== 'string' || input.title.trim().length === 0) {
    throw new ApiError('A simulation title is required.', 400);
  }

  if (
    typeof input.difficulty !== 'string' ||
    !Object.prototype.hasOwnProperty.call(DIFFICULTY_SETTINGS, input.difficulty)
  ) {
    throw new ApiError('A valid simulation difficulty is required.', 400);
  }

  if (input.description !== undefined && input.description !== null && typeof input.description !== 'string') {
    throw new ApiError('Description must be a string.', 400);
  }

  if (input.ai_generated !== undefined && typeof input.ai_generated !== 'boolean') {
    throw new ApiError('ai_generated must be a boolean.', 400);
  }
  const isAi = input.ai_generated === true;
  if (!isAi && (!Array.isArray(input.events) || input.events.length === 0 || !input.events.every(validateEvent))) {
    throw new ApiError('At least one valid simulation event is required.', 400);
  }

  const difficulty = input.difficulty as keyof typeof DIFFICULTY_SETTINGS;
  if (input.sys !== undefined && input.sys !== 'spectre' && input.sys !== 'cm') {
    throw new ApiError('A valid target system is required.', 400);
  }
  const settings = DIFFICULTY_SETTINGS[difficulty];
  let aiReports: AiReportInput[] | undefined;
  let lengthSeconds: number = settings.lengthSeconds;
  if (isAi) {
    if (typeof input.length_s !== 'number' || !Number.isInteger(input.length_s) || input.length_s < 60 || input.length_s > 7200) {
      throw new ApiError('AI simulation duration must be between 60 and 7200 seconds.', 400);
    }
    lengthSeconds = input.length_s;
    if (!Array.isArray(input.reports) || input.reports.length === 0 || input.reports.length > 1440) {
      throw new ApiError('Between 1 and 1440 AI reports are required.', 400);
    }
    aiReports = input.reports.map((report) => validateAiReport(report, lengthSeconds));
    if (new Set(aiReports.map((report) => report.client_id)).size !== aiReports.length) {
      throw new ApiError('AI report client IDs must be unique.', 400);
    }
  }
  const events = isAi ? [] : input.events as SimulationEventInput[];
  if (events.some((event) => event.minute * 60 > settings.lengthSeconds)) {
    throw new ApiError('Simulation events must fall within the simulation duration.', 400);
  }

  return {
    title: input.title.trim(),
    description: typeof input.description === 'string' ? input.description.trim() || null : null,
    difficulty,
    sys: input.sys === 'cm' ? 'cm' : 'spectre',
    events,
    aiReports,
    lengthSeconds,
  };
}

export function validateAiReport(value: unknown, lengthSeconds: number): AiReportInput {
  if (typeof value !== 'object' || value === null) throw new ApiError('Invalid AI report.', 400);
  const report = value as Record<string, unknown>;
  if (typeof report.client_id !== 'string' || !UUID_PATTERN.test(report.client_id)
    || typeof report.dispatch_offset_s !== 'number' || !Number.isInteger(report.dispatch_offset_s)
    || report.dispatch_offset_s < 0 || report.dispatch_offset_s > lengthSeconds
    || typeof report.category_name !== 'string' || !report.category_name.trim()
    || (report.template_id !== null && (typeof report.template_id !== 'string' || !UUID_PATTERN.test(report.template_id)))
    || typeof report.payload !== 'object' || report.payload === null) {
    throw new ApiError('Invalid AI report identity, category, timing or payload.', 400);
  }
  const raw = report.payload as Record<string, unknown>;
  if (raw.reality_id !== REALITY_ID) throw new ApiError('AI reports must use synthetic reality 1.', 400);
  const payload: Record<string, unknown> = {};
  for (const [field, validate] of Object.entries(reportFields)) {
    const result = validate(raw[field]);
    if (!result.ok) throw new ApiError(`Invalid report ${field}: ${result.error}`, 400);
    if (typeof result.value === 'number' && Number.isInteger(result.value) && result.value > 2147483647
      && (field === 'schema_version' || field.endsWith('_count'))) {
      throw new ApiError(`Invalid report ${field}: exceeds database integer range.`, 400);
    }
    payload[field] = result.value;
  }
  for (const field of ['original_content', 'translated_content']) {
    const content = raw[field];
    if (typeof content === 'string') {
      if (content.length > 50000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(content)) {
        throw new ApiError(`Invalid report ${field}: unsupported length or control characters.`, 400);
      }
      payload[field] = content;
    }
  }
  for (const [field, fallback] of [['media_type', ['text']], ['categories', [report.category_name]]] as const) {
    const result = vStringArray()(raw[field] ?? [...fallback]);
    if (!result.ok) throw new ApiError(`Invalid report ${field}: ${result.error}`, 400);
    payload[field] = result.value;
  }
  return {
    client_id: report.client_id, template_id: report.template_id,
    dispatch_offset_s: report.dispatch_offset_s, category_name: report.category_name.trim(), payload,
  };
}

async function fetchSimulations(query: string, values: unknown[] = []) {
  const { rows } = await db.query(
    `${SIMULATION_SELECT} ${query} GROUP BY s.id ORDER BY s.created_at DESC`,
    values,
  );
  return rows;
}

export async function listSimulations() {
  return fetchSimulations('');
}

export async function getSimulation(id: string) {
  if (!UUID_PATTERN.test(id)) throw new ApiError('Simulation not found.', 404);

  const simulations = await fetchSimulations('WHERE s.id = $1', [id]);
  if (simulations.length === 0) throw new ApiError('Simulation not found.', 404);
  return simulations[0];
}

export async function createSimulation(value: unknown) {
  const input = validateCreateInput(value);
  const settings = DIFFICULTY_SETTINGS[input.difficulty];
  let client: PoolClient | undefined;
  let transactionStarted = false;

  try {
    client = await db.connect();
    const { h64 } = await xxhashPromise;
    await client.query('BEGIN');
    transactionStarted = true;

    const { rows } = await client.query(
      `INSERT INTO simulations (name, description, difficulty, length_s, target_system${input.aiReports ? ', ai_generated' : ''})
       VALUES ($1, $2, $3, $4, $5${input.aiReports ? ', true' : ''})
       RETURNING id, name AS title, description, difficulty, length_s AS "lengthSeconds",
                 target_system AS "targetSystem", created_at AS "createdAt"`,
      [
        input.title,
        input.description,
        settings.databaseValue,
        input.lengthSeconds,
        input.sys === 'cm' ? 'combat' : 'specter',
      ],
    );
    const simulation = rows[0];

    const aiReports = input.aiReports ?? [];
    const columns = [...Object.keys(reportFields), 'media_type', 'categories'];
    for (let start = 0; start < aiReports.length; start += AI_REPORT_BATCH_SIZE) {
      const reportValues: unknown[] = [];
      const linkValues: unknown[] = [];
      const reportRows: string[] = [];
      const linkRows: string[] = [];
      for (const report of aiReports.slice(start, start + AI_REPORT_BATCH_SIZE)) {
        // Simulation-scoped URLs isolate editable copies, including repeated library templates.
        const reportUrl = `https://cobra.invalid/simulations/${simulation.id}/events/${report.client_id}`;
        const reportId = BigInt.asIntN(64, h64(`${REALITY_ID}${report.payload.platform}${reportUrl}`)).toString();
        const values = [
          reportId, REALITY_ID, report.template_id,
          ...columns.map((column) => column === 'report_url' ? reportUrl : report.payload[column]),
        ];
        reportRows.push(`(${values.map((_, index) => `$${reportValues.length + index + 1}`).join(', ')})`);
        reportValues.push(...values);
        linkRows.push(`($${linkValues.length + 1}, $${linkValues.length + 2}, $${linkValues.length + 3})`);
        linkValues.push(simulation.id, reportId, report.dispatch_offset_s);
      }
      await client.query(
        `INSERT INTO reports (report_id, reality_id, template_id, ${columns.join(', ')})
         VALUES ${reportRows.join(', ')}`,
        reportValues,
      );
      await client.query(
        `INSERT INTO report_in_simulation (simulation_id, report_id, dispatch_offset_s)
         VALUES ${linkRows.join(', ')}`,
        linkValues,
      );
    }

    for (const event of input.events) {
      const reportUrl = `https://cobra.invalid/simulations/${simulation.id}/events/${encodeURIComponent(event.id)}`;
      const reportId = BigInt.asIntN(
        64,
        h64(`${REALITY_ID}${REPORT_PLATFORM}${reportUrl}`),
      ).toString();
      const reportResult = await client.query(
        `INSERT INTO reports (
           report_id, reality_id, schema_version, is_official, platform, report_url,
           report_title, original_language, categories, collected_at, original_content
         )
         VALUES ($1, $2, 2, false, $3, $4, $5, 'he', ARRAY[$7]::text[], now() AT TIME ZONE 'utc', $6)
         RETURNING report_id`,
        [
          reportId,
          REALITY_ID,
          REPORT_PLATFORM,
          reportUrl,
          event.title.trim(),
          event.description.trim(),
          event.category,
        ],
      );

      await client.query(
        `INSERT INTO report_in_simulation (simulation_id, report_id, dispatch_offset_s)
         VALUES ($1, $2, $3)`,
        [simulation.id, reportResult.rows[0].report_id, event.minute * 60],
      );
    }

    await client.query('COMMIT');
    transactionStarted = false;
    return { ...simulation, eventCount: input.aiReports?.length ?? input.events.length };
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Failed to roll back simulation creation:', rollbackError);
      }
    }
    throw error;
  } finally {
    client?.release();
  }
}

export async function deleteSimulation(id: string): Promise<void> {
  if (!UUID_PATTERN.test(id)) throw new ApiError('Simulation not found.', 404);

  try {
    const result = await db.query('DELETE FROM simulations WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) throw new ApiError('Simulation not found.', 404);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if ((error as { code?: string }).code === '23503') {
      throw new ApiError('A simulation with existing runs cannot be deleted.', 409);
    }
    throw error;
  }
}