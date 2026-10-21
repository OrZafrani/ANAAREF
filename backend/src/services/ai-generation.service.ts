import { randomInt, randomUUID } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { ApiError } from './api-error.js';
import { reportFields } from '../lib/reportFields.js';
import { validateAiReport } from './simulations.service.js';

interface GenerationInput {
  description: string;
  region: string;
  country: string;
  area: { lat_min: number; lat_max: number; long_min: number; long_max: number };
  length_s: number;
  report_count: number;
  noise_level: 'low' | 'medium' | 'high';
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApiError('Invalid AI service response or request object.', 502);
  }
  return value as Record<string, unknown>;
}

export function validateGenerationInput(value: unknown): GenerationInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApiError('A generation request is required.', 400);
  }
  const input = value as Record<string, unknown>;
  const area = typeof input.area === 'object' && input.area !== null
    ? input.area as Record<string, unknown> : {};
  if (typeof input.description !== 'string' || input.description.trim().length < 10 || input.description.length > 2000
    || typeof input.region !== 'string' || !input.region.trim() || input.region.length > 200
    || typeof input.country !== 'string' || !/^[A-Z]{2}$/.test(input.country)
    || typeof input.length_s !== 'number' || !Number.isInteger(input.length_s) || input.length_s < 60 || input.length_s > 7200
    || typeof input.report_count !== 'number' || !Number.isInteger(input.report_count) || input.report_count < 1 || input.report_count > 100
    || (input.noise_level !== 'low' && input.noise_level !== 'medium' && input.noise_level !== 'high')) {
    throw new ApiError('Invalid description, region, country, duration, report count (1–100), or noise level.', 400);
  }
  const { lat_min, lat_max, long_min, long_max } = area;
  if (typeof lat_min !== 'number' || !Number.isFinite(lat_min) || lat_min < -90
    || typeof lat_max !== 'number' || !Number.isFinite(lat_max) || lat_max > 90 || lat_min >= lat_max
    || typeof long_min !== 'number' || !Number.isFinite(long_min) || long_min < -180
    || typeof long_max !== 'number' || !Number.isFinite(long_max) || long_max > 180 || long_min >= long_max) {
    throw new ApiError('Valid geographic bounds are required (minimum must be less than maximum).', 400);
  }
  return {
    description: input.description.trim(), region: input.region.trim(), country: input.country,
    area: { lat_min, lat_max, long_min, long_max },
    length_s: input.length_s, report_count: input.report_count, noise_level: input.noise_level,
  };
}

async function upstream(path: string, body?: unknown): Promise<Response> {
  const base = process.env.COBRA_API;
  const token = process.env.COBRA_API_TOKEN;
  if (!base || !token) throw new ApiError('AI generation is not configured. Set COBRA_API and COBRA_API_TOKEN on the backend.', 503);
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
      redirect: 'error',
    });
  } catch (error) {
    console.error('Cobra AI request failed:', { path, name: error instanceof Error ? error.name : 'UnknownError' });
    throw new ApiError('Cannot reach the AI service. Check the port-forward and try again.', 503);
  }
  if (!response.ok) {
    const error: unknown = await response.json().catch(() => null);
    const details = error && typeof error === 'object' ? error as Record<string, unknown> : {};
    const message = typeof details.message === 'string' ? details.message : `AI service returned HTTP ${response.status}.`;
    const issues = Array.isArray(details.issues) ? details.issues.filter((issue): issue is string => typeof issue === 'string') : [];
    throw new ApiError([message, ...issues].join(' '), [400, 404, 409, 413].includes(response.status) ? response.status : 502);
  }
  return response;
}

async function upstreamJson(path: string, body?: unknown) {
  const response = await upstream(path, body);
  try {
    return object(await response.json());
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('The AI service returned invalid JSON.', 502);
  }
}

export async function startGeneration(value: unknown) {
  const input = validateGenerationInput(value);
  const start = new Date();
  const response = await upstreamJson('/runs', {
    scenario: {
      name: `cobra_ui_${randomUUID().replace(/-/g, '').slice(0, 20)}`,
      description: input.description, region: input.region, countries: [input.country], area: input.area,
      time_from: start.toISOString(), time_to: new Date(start.getTime() + input.length_s * 1000).toISOString(),
      noise_level: input.noise_level, report_count: input.report_count, formal_ratio: 40, arabic_ratio: 0,
    },
    seed: randomInt(1, 2147483647),
  });
  if (typeof response.run_id !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(response.run_id)
    || (response.status !== 'queued' && response.status !== 'running')) {
    throw new ApiError('The AI service returned an invalid generation job.', 502);
  }
  return { runId: response.run_id, status: response.status };
}

const numericFields = new Set([
  'schema_version', 'threat_level', 'lat', 'long',
  'red_injured_count', 'red_death_count', 'blue_injured_count', 'blue_death_count',
]);

export function convertReportCsv(csv: string, expectedCount: number, lengthSeconds: number) {
  let rows: Record<string, string>[];
  try {
    rows = parse(csv, {
      bom: true, skip_empty_lines: true, max_record_size: 250000,
      columns: (headers: string[]) => {
        const required = [...Object.keys(reportFields), 'dispatch_offset_s'];
        if (new Set(headers).size !== headers.length || required.some((field) => !headers.includes(field))) {
          throw new Error('Missing or duplicate report columns.');
        }
        return headers;
      },
    });
  } catch {
    throw new ApiError('The AI CSV is malformed or is missing required report columns.', 502);
  }
  if (rows.length > expectedCount || rows.length > 100) {
    throw new ApiError('The AI CSV report count exceeds the requested count.', 502);
  }
  const reports: ReturnType<typeof convertReportRow>[] = [];
  const warnings: string[] = [];
  for (const [index, row] of rows.entries()) {
    try {
      reports.push(convertReportRow(row, lengthSeconds));
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      warnings.push(`Skipped invalid AI CSV row ${index + 1}: ${error.message}`);
    }
  }
  if (reports.length === 0) {
    throw new ApiError('The AI generation returned no valid reports.', 502);
  }
  if (reports.length < expectedCount) {
    warnings.unshift(`נוצרו ${reports.length} דיווחים תקינים מתוך ${expectedCount} דיווחים שהתבקשו. דיווחים לא תקינים לא יובאו.`);
  }
  return { reports: reports.sort((a, b) => a.dispatch_offset_s - b.dispatch_offset_s), warnings };
}

function convertReportRow(row: Record<string, string>, lengthSeconds: number) {
  const payload: Record<string, unknown> = { reality_id: 1 };
  for (const field of Object.keys(reportFields)) {
    const cell = row[field];
    if (field === 'is_official') {
      if (!/^(true|false)$/i.test(cell)) throw new ApiError('Invalid CSV boolean.', 502);
      payload[field] = cell.toLowerCase() === 'true';
    } else if (numericFields.has(field)) {
      const number = cell.trim() === '' ? null : Number(cell);
      if (number !== null && !Number.isFinite(number)) throw new ApiError(`Invalid CSV number: ${field}.`, 502);
      payload[field] = number;
    } else {
      payload[field] = cell.trim() === '' ? null : cell;
    }
  }
  // `matches` is an obsolete upstream column, not a report kind or a DB field.
  const offset = row.dispatch_offset_s.trim() === '' ? NaN : Number(row.dispatch_offset_s);
  const report = {
    client_id: randomUUID(), template_id: null, dispatch_offset_s: offset,
    category_name: 'דיווח AI', payload,
  };
  const validated = validateAiReport(report, lengthSeconds);
  const normalizedPayload: Record<string, unknown> = { ...validated.payload, reality_id: 1 };
  return { ...validated, payload: normalizedPayload, kind: 'unclassified' as const, origin: 'ai' as const };
}

export async function getGeneration(runId: string) {
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(runId)) throw new ApiError('Invalid generation ID.', 400);
  const path = `/runs/${encodeURIComponent(runId)}`;
  const response = await upstreamJson(path);
  if (response.status === 'queued' || response.status === 'running') return { runId, status: response.status };
  if (response.status === 'failed') {
    const issues = Array.isArray(response.issues) ? response.issues.filter((issue): issue is string => typeof issue === 'string') : [];
    return { runId, status: 'failed', error: [typeof response.error === 'string' ? response.error : 'AI generation failed.', ...issues].join(' ') };
  }
  if (response.status !== 'completed') throw new ApiError('Unknown AI generation status.', 502);
  const result = object(response.result);
  const check = object(result.check);
  const warnings = Array.isArray(check.warnings) ? check.warnings.filter((item): item is string => typeof item === 'string') : [];
  if (result.ok !== true || check.passed !== true) {
    const failures = Array.isArray(check.hard_failures) ? check.hard_failures.filter((item): item is string => typeof item === 'string') : [];
    warnings.unshift(`AI quality checks failed. Only individually validated reports were imported. ${failures.join(' ')}`.trim());
  }
  const request = object(response.request);
  const scenario = object(request.scenario);
  const count = request.n ?? scenario.report_count;
  const duration = typeof scenario.time_from === 'string' && typeof scenario.time_to === 'string'
    ? (Date.parse(scenario.time_to) - Date.parse(scenario.time_from)) / 1000 : NaN;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 100
    || !Number.isInteger(duration) || duration < 60 || duration > 7200
    || !Array.isArray(result.files) || !result.files.includes('reports.csv')) {
    throw new ApiError('The completed AI job has invalid metadata or no report CSV.', 502);
  }
  const file = await upstream(`${path}/files/reports.csv`);
  const csv = await file.text();
  if (Buffer.byteLength(csv, 'utf8') > 10 * 1024 * 1024) throw new ApiError('The AI report CSV exceeds 10 MB.', 502);
  const converted = convertReportCsv(csv, count, duration);
  return { runId, status: 'completed', reports: converted.reports, warnings: [...warnings, ...converted.warnings] };
}
