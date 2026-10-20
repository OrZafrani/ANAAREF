import type { LibraryTemplate } from './libraryApi';
import { MOCK_LIBRARY_CATEGORIES, MOCK_LIBRARY_TEMPLATES, MOCK_REPORT_PAYLOAD, MOCK_REPORT_STAGES } from '../data/aiSimulationFixtures';
import type {
  AiDifficulty, AiSimulationDraft, AiSimulationReport, AiSimulationSettings,
  GenerationSettings, ReportKind,
} from '../types/aiSimulation';

export const DIFFICULTY_PRESETS: Record<AiDifficulty, {
  label: string; length_s: number; generation: GenerationSettings;
}> = {
  easy: { label: 'קל', length_s: 1200, generation: { reports_per_minute: 2, duplicate_percent: 5, false_percent: 5, noise_percent: 10 } },
  medium: { label: 'בינוני', length_s: 1800, generation: { reports_per_minute: 4, duplicate_percent: 15, false_percent: 10, noise_percent: 25 } },
  hard: { label: 'קשה', length_s: 2700, generation: { reports_per_minute: 8, duplicate_percent: 25, false_percent: 20, noise_percent: 40 } },
};

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  original: 'מקורי', duplicate: 'כפול', false: 'שגוי', noise: 'רעש רקע',
};

export function createAiDraft(): AiSimulationDraft {
  const now = new Date().toISOString();
  return {
    version: 1,
    simulation: {
      id: crypto.randomUUID(), name: '', description: '', difficulty: 'medium',
      length_s: 1800, ai_generated: true, target_system: 'specter', reality_id: 1,
    },
    generation: { ...DIFFICULTY_PRESETS.medium.generation },
    scenario: '',
    messages: [{
      id: crypto.randomUUID(), role: 'assistant',
      content: 'שלום! תארו את תרחיש התרגול: מה קורה, היכן, ומה ידוע על הנפגעים. אפשר לתאר כמה תקריות ולבקש שינויים בהמשך. במצב ההדגמה התשובות והדיווחים נוצרים מקומית לפי כללים קבועים, ללא שירות AI.',
    }],
    reports: [], generated_from: null, step: 1, status: 'draft', created_at: now, updated_at: now,
  };
}

export function reportCount(simulation: AiSimulationSettings, generation: GenerationSettings) {
  return Math.round(simulation.length_s / 60 * generation.reports_per_minute);
}

export function generationFingerprint(draft: AiSimulationDraft) {
  return JSON.stringify([draft.scenario, draft.simulation.difficulty, draft.simulation.length_s, draft.generation]);
}

export function validateAiSettings(draft: AiSimulationDraft): string[] {
  const { simulation: s, generation: g } = draft;
  const errors: string[] = [];
  if (!draft.scenario.trim()) errors.push('תארו את התרחיש בשיחה לפני יצירת הסימולציה.');
  if (!s.name.trim()) errors.push('נא להזין שם לסימולציה.');
  if (!s.description.trim()) errors.push('נא להזין תיאור לסימולציה.');
  if (!Number.isInteger(s.length_s) || s.length_s < 600 || s.length_s > 7200) errors.push('משך הסימולציה חייב להיות בין 10 ל-120 דקות.');
  if (!Number.isFinite(g.reports_per_minute) || g.reports_per_minute < 0.5 || g.reports_per_minute > 12) errors.push('קצב הדיווחים חייב להיות בין 0.5 ל-12 לדקה.');
  const percentages = [g.duplicate_percent, g.false_percent, g.noise_percent];
  if (percentages.some((n) => !Number.isInteger(n) || n < 0 || n > 100) || percentages.reduce((a, b) => a + b, 0) >= 100) {
    errors.push('סך הכפולים, השגויים ורעש הרקע חייב להיות קטן מ-100%, כדי להשאיר דיווחים מקוריים.');
  }
  return errors;
}

export function validateAiReports(draft: AiSimulationDraft): string[] {
  if (draft.reports.length === 0) return ['יש להוסיף לפחות דיווח אחד לפני השמירה.'];
  if (draft.reports.some((r) => r.dispatch_offset_s < 0 || r.dispatch_offset_s > draft.simulation.length_s)) {
    return ['יש דיווחים מחוץ למשך הסימולציה. עדכנו את העיתוי או צרו מחדש את הדיווחים.'];
  }
  return [];
}

export function formatOffset(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 400));

async function replyToScenario(draft: AiSimulationDraft, message: string): Promise<AiSimulationDraft> {
  await wait();
  const difficulty: AiDifficulty = /(?:^|[\s,.;])קשה(?:$|[\s,.;])/.test(message) ? 'hard'
    : /(?:^|[\s,.;])קלה?(?:$|[\s,.;])/.test(message) ? 'easy'
      : /בינוני/.test(message) ? 'medium' : draft.simulation.difficulty;
  const preset = DIFFICULTY_PRESETS[difficulty];
  const duration = message.match(/(\d+)\s*דקות/);
  const scenario = [draft.scenario, message.trim()].filter(Boolean).join('\n');
  const simulation: AiSimulationSettings = {
    ...draft.simulation,
    name: draft.simulation.name || `תרחיש AI — ${message.trim().slice(0, 55)}`,
    description: draft.simulation.description || message.trim(),
    difficulty,
    length_s: duration ? Number(duration[1]) * 60 : difficulty !== draft.simulation.difficulty ? preset.length_s : draft.simulation.length_s,
  };
  return {
    ...draft,
    scenario, simulation,
    generation: difficulty !== draft.simulation.difficulty ? { ...preset.generation } : draft.generation,
    messages: [...draft.messages,
      { id: crypto.randomUUID(), role: 'user', content: message.trim() },
      {
        id: crypto.randomUUID(), role: 'assistant',
        content: `התרחיש נוסף להקשר ההדגמה. ${duration ? `משך התרגיל עודכן ל-${duration[1]} דקות. ` : ''}רמת הקושי: ${preset.label}. אפשר להמשיך לחדד את התרחיש או לערוך את ההגדרות בצד. השם והתיאור שמילאתם ידנית נשמרים. יצירת הדיווחים תשתמש בכל ההודעות שנשלחו.`,
      },
    ],
  };
}

const LOCATIONS = [
  { city: 'שדרות', lat: 31.525, long: 34.596 },
  { city: 'ירושלים', lat: 31.781, long: 35.219 },
  { city: 'מטולה', lat: 33.279, long: 35.578 },
  { city: 'חיפה', lat: 32.794, long: 34.989 },
  { city: 'באר שבע', lat: 31.252, long: 34.792 },
];

async function generateReports(draft: AiSimulationDraft): Promise<AiSimulationReport[]> {
  const errors = validateAiSettings(draft);
  if (errors.length) throw new Error(errors.join(' '));
  await wait();
  const count = reportCount(draft.simulation, draft.generation);
  const { duplicate_percent, false_percent, noise_percent } = draft.generation;
  const counts: Record<ReportKind, number> = {
    duplicate: Math.floor(count * duplicate_percent / 100),
    false: Math.floor(count * false_percent / 100),
    noise: Math.floor(count * noise_percent / 100),
    original: 0,
  };
  counts.original = count - counts.duplicate - counts.false - counts.noise;
  const kinds: ReportKind[] = [];
  for (const kind of ['original', 'duplicate', 'false', 'noise'] as const) {
    for (let i = 0; i < counts[kind]; i++) kinds.push(kind);
  }
  // Stable interleaving keeps the preview deterministic without grouping all noise at the end.
  const ordered = kinds.map((kind, index) => ({ kind, order: (index * 137) % (count + 1) }))
    .sort((a, b) => a.order - b.order);
  const locations = LOCATIONS.filter((place) => draft.scenario.includes(place.city));
  const originals: AiSimulationReport[] = [];
  const reports: AiSimulationReport[] = [];
  const baseTime = Date.parse(draft.created_at);
  for (let i = 0; i < ordered.length; i++) {
    const kind = ordered[i].kind;
    const location = locations.length ? locations[i % locations.length] : null;
    const offset = Math.floor(i * 60 / draft.generation.reports_per_minute);
    const source = kind === 'duplicate' ? originals[i % originals.length] : undefined;
    const stage = MOCK_REPORT_STAGES[i % MOCK_REPORT_STAGES.length];
    const payload = source ? { ...source.payload, matches: [...(source.payload.matches ?? [])] } : {
      ...MOCK_REPORT_PAYLOAD,
      matches: [...(MOCK_REPORT_PAYLOAD.matches ?? [])],
      platform: i % 3 === 0 ? 'telegram' : i % 3 === 1 ? 'web' : 'twitter',
      is_official: kind === 'original' && i % 3 === 1,
      city: location?.city ?? null,
      lat: location?.lat ?? null,
      long: location?.long ?? null,
      threat_level: kind === 'noise' ? 10 : kind === 'false' ? 35 : draft.simulation.difficulty === 'hard' ? 80 : 50,
      original_content: kind === 'noise'
        ? 'הודעת שגרה סינתטית: בדיקת מערכת כריזה מתוכננת. אינה קשורה לתרחיש.'
        : `${kind === 'false' ? 'דיווח תרגול לא מאומת, המיועד לסינון מידע שגוי.' : stage.content}\nסינתטי · הקשר התרחיש:\n${draft.scenario}`,
    };
    const report: AiSimulationReport = {
      client_id: crypto.randomUUID(), template_id: null, kind, origin: 'ai',
      category_name: kind === 'noise' ? 'רעש רקע' : 'תרחיש AI',
      dispatch_offset_s: offset,
      payload: {
        ...payload,
        report_title: kind === 'duplicate' && source
          ? `דיווח חוזר: ${source.payload.report_title}`
          : `${kind === 'noise' ? 'הודעת שגרה: בדיקת מערכת כריזה' : kind === 'false' ? 'שמועה לא מאומתת לצורכי תרגול' : stage.title} · ${location?.city ?? 'תרחיש התרגול'} · ${i + 1}`,
        report_url: `https://example.invalid/cobra/${draft.simulation.id}/report-${i + 1}`,
        published_at: new Date(baseTime + offset * 1000).toISOString(),
        happened_at: new Date(baseTime + offset * 1000).toISOString(),
        collected_at: new Date(baseTime + offset * 1000).toISOString(),
      },
    };
    if (kind === 'original') originals.push(report);
    reports.push(report);
  }
  return reports;
}

export function templateToAiReport(template: LibraryTemplate, minute: number): AiSimulationReport {
  const {
    id, category_id: _categoryId, sub_category_id: _subCategoryId,
    category_name, sub_category_name: _subCategoryName,
    template_created_at: _createdAt, template_updated_at: _updatedAt, ...payload
  } = template;
  return {
    client_id: crypto.randomUUID(), template_id: id, payload: { ...payload, reality_id: 1, matches: payload.matches ? [...payload.matches] : null },
    dispatch_offset_s: minute * 60, kind: 'original', origin: 'library',
    category_name: category_name ?? 'ספריית תוכן',
  };
}

export const aiSimulationService = {
  replyToScenario,
  generateReports,
  async loadLibrary() {
    await wait();
    return { categories: structuredClone(MOCK_LIBRARY_CATEGORIES), templates: structuredClone(MOCK_LIBRARY_TEMPLATES) };
  },
};
