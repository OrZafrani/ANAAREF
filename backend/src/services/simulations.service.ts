import type { PoolClient } from 'pg';
import xxhash from 'xxhash-wasm';
import { db } from '../db.js';
import { ApiError } from './api-error.js';

const xxhashPromise = xxhash();
const REALITY_ID = 1;
const REPORT_PLATFORM = 'cobra-manual';
const EVENT_CATEGORIES = new Set(['מבצעי', 'התראה', 'תקלה', 'חירום', 'תקשורת']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SimulationEventInput {
  id: string;
  title: string;
  category: string;
  minute: number;
  description: string;
}

interface CreateSimulationInput {
  title: string;
  description: string | null;
  difficulty: keyof typeof DIFFICULTY_SETTINGS;
  events: SimulationEventInput[];
}

const DIFFICULTY_SETTINGS = {
  קל: { databaseValue: 'easy', lengthSeconds: 20 * 60 },
  בינוני: { databaseValue: 'medium', lengthSeconds: 30 * 60 },
  קשה: { databaseValue: 'hard', lengthSeconds: 45 * 60 },
  מומחה: { databaseValue: 'expert', lengthSeconds: 60 * 60 },
} as const;

const SIMULATION_SELECT = `
  SELECT s.id,
         s.name AS title,
         s.description,
         CASE s.difficulty::text
           WHEN 'easy' THEN 'קל'
           WHEN 'medium' THEN 'בינוני'
           WHEN 'hard' THEN 'קשה'
           WHEN 'expert' THEN 'מומחה'
           ELSE s.difficulty::text
         END AS difficulty,
         s.created_at AS "createdAt",
         COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id', ris.report_id::text,
               'title', r.report_title,
               'category', COALESCE(
                 r.matches[1],
                 substring(r.original_content FROM E'^סיווג: ([^\\n]*)'),
                 'מבצעי'
               ),
               'minute', ris.dispatch_offset_s / 60,
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

  if (!Array.isArray(input.events) || input.events.length === 0 || !input.events.every(validateEvent)) {
    throw new ApiError('At least one valid simulation event is required.', 400);
  }

  const difficulty = input.difficulty as keyof typeof DIFFICULTY_SETTINGS;
  const settings = DIFFICULTY_SETTINGS[difficulty];
  if (input.events.some((event) => event.minute * 60 > settings.lengthSeconds)) {
    throw new ApiError('Simulation events must fall within the simulation duration.', 400);
  }

  return {
    title: input.title.trim(),
    description: typeof input.description === 'string' ? input.description.trim() || null : null,
    difficulty,
    events: input.events,
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
      `INSERT INTO simulations (name, description, difficulty, length_s, target_system)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name AS title, description, difficulty, length_s AS "lengthSeconds",
                 target_system AS "targetSystem", created_at AS "createdAt"`,
      [input.title, input.description, settings.databaseValue, settings.lengthSeconds, 'specter'],
    );
    const simulation = rows[0];

    for (const event of input.events) {
      const reportUrl = `https://cobra.invalid/simulations/${simulation.id}/events/${encodeURIComponent(event.id)}`;
      const reportId = BigInt.asIntN(
        64,
        h64(`${REALITY_ID}${REPORT_PLATFORM}${reportUrl}`),
      ).toString();
      const reportResult = await client.query(
        `INSERT INTO reports (
           report_id, reality_id, schema_version, is_official, platform, report_url,
           report_title, original_language, matches, collected_at, original_content
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
    return { ...simulation, eventCount: input.events.length };
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