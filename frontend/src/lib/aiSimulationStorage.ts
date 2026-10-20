import type { AiSimulationDraft } from '../types/aiSimulation';

export const AI_SIMULATIONS_KEY = 'cobra_ai_simulations_v1';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isDate = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const isNullableText = (value: unknown) => value === null || typeof value === 'string';

function isDraft(value: unknown): value is AiSimulationDraft {
  if (!isObject(value) || value.version !== 1 || !isObject(value.simulation) || !isObject(value.generation)) return false;
  const s = value.simulation;
  const g = value.generation;
  const area = g.area;
  if (typeof s.id !== 'string' || typeof s.name !== 'string' || typeof s.description !== 'string'
    || !['easy', 'medium', 'hard'].includes(String(s.difficulty))
    || !isNumber(s.length_s) || s.length_s < 60 || s.length_s > 7200
    || s.reality_id !== 1 || s.ai_generated !== true || s.target_system !== 'specter') return false;
  if (!isNumber(g.reports_per_minute) || g.reports_per_minute < 0.5 || g.reports_per_minute > 12
    || !['low', 'medium', 'high'].includes(String(g.noise_level))
    || typeof g.region !== 'string' || typeof g.country !== 'string' || !isObject(area)
    || !['lat_min', 'lat_max', 'long_min', 'long_max'].every((key) => area[key] === null || isNumber(area[key]))) return false;
  if (typeof value.scenario !== 'string' || !isNullableText(value.generated_from)
    || (value.step !== 1 && value.step !== 2 && value.step !== 3)
    || (value.status !== 'draft' && value.status !== 'saved') || !isDate(value.created_at) || !isDate(value.updated_at)) return false;
  if (!Array.isArray(value.messages) || !value.messages.every((m: unknown) =>
    isObject(m) && typeof m.id === 'string' && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))) return false;
  if (!Array.isArray(value.reports)) return false;
  return value.reports.every((report: unknown) => {
    if (!isObject(report) || !isObject(report.payload)) return false;
    const p = report.payload;
    return typeof report.client_id === 'string' && isNullableText(report.template_id)
      && isNumber(report.dispatch_offset_s) && Number.isInteger(report.dispatch_offset_s) && report.dispatch_offset_s >= 0
      && ['original', 'duplicate', 'false', 'noise', 'unclassified'].includes(String(report.kind))
      && (report.origin === 'ai' || report.origin === 'library') && typeof report.category_name === 'string'
      && p.reality_id === 1 && isNumber(p.schema_version) && typeof p.is_official === 'boolean'
      && typeof p.platform === 'string' && typeof p.report_url === 'string' && typeof p.original_content === 'string'
      && isDate(p.collected_at)
      && ['account_name', 'channel_name', 'report_title', 'original_language', 'translated_content', 'country', 'city', 'fastbreak_model_version']
        .every((key) => isNullableText(p[key]))
      && ['published_at', 'happened_at'].every((key) => p[key] === null || isDate(p[key]))
      && ['lat', 'long', 'threat_level', 'red_injured_count', 'red_death_count', 'blue_injured_count', 'blue_death_count']
        .every((key) => p[key] === null || isNumber(p[key]));
  });
}

export function loadAiSimulations(): AiSimulationDraft[] {
  const raw = localStorage.getItem(AI_SIMULATIONS_KEY);
  if (raw === null) return [];
  const data: unknown = JSON.parse(raw);
  const migrated = Array.isArray(data) ? data.map((value: unknown) => {
    if (!isObject(value) || !isObject(value.generation) || value.generation.noise_level !== undefined) return value;
    const old = value.generation;
    if (!['duplicate_percent', 'false_percent', 'noise_percent'].every((key) => isNumber(old[key]) && Number.isInteger(old[key]) && old[key] >= 0 && old[key] <= 100)) return value;
    return {
      ...value,
      generation: {
        reports_per_minute: old.reports_per_minute, noise_level: 'medium', region: '', country: 'IL',
        area: { lat_min: null, lat_max: null, long_min: null, long_max: null },
      },
    };
  }) : data;
  if (!Array.isArray(migrated) || !migrated.every(isDraft)) {
    throw new Error('נתוני סימולציות ה-AI המקומיים אינם תקינים או אינם תואמים לגרסה הזו. לא בוצעה דריסה של הנתונים.');
  }
  return migrated;
}

export function saveAiSimulation(draft: AiSimulationDraft, status: 'draft' | 'saved'): AiSimulationDraft {
  const saved = { ...draft, status, updated_at: new Date().toISOString() };
  if (!isDraft(saved)) throw new Error('לא ניתן לשמור: נתוני הסימולציה אינם תקינים.');
  const existing = loadAiSimulations();
  localStorage.setItem(AI_SIMULATIONS_KEY, JSON.stringify([saved, ...existing.filter((item) => item.simulation.id !== saved.simulation.id)]));
  return saved;
}

export function deleteAiSimulation(id: string) {
  const remaining = loadAiSimulations().filter((item) => item.simulation.id !== id);
  localStorage.setItem(AI_SIMULATIONS_KEY, JSON.stringify(remaining));
}
