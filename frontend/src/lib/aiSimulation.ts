import type { LibraryTemplate } from './libraryApi';
import type { DifficultyLevel } from '../types/simulation';
import { getAiGeneration, startAiGeneration } from './api';
import type {
  AiDifficulty, AiSimulationDraft, AiSimulationReport, AiSimulationSettings,
  GenerationSettings, GenerationStatus, ReportKind,
} from '../types/aiSimulation';

export const DIFFICULTY_PRESETS: Record<AiDifficulty, {
  label: DifficultyLevel; length_s: number; generation: Pick<GenerationSettings, 'reports_per_minute' | 'noise_level'>;
}> = {
  easy: { label: 'קל', length_s: 1200, generation: { reports_per_minute: 1, noise_level: 'low' } },
  medium: { label: 'בינוני', length_s: 1800, generation: { reports_per_minute: 2, noise_level: 'medium' } },
  hard: { label: 'קשה', length_s: 2700, generation: { reports_per_minute: 2, noise_level: 'high' } },
};

export const NOISE_LABELS = { low: 'נמוכה', medium: 'בינונית', high: 'גבוהה' };
export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  original: 'מקורי', duplicate: 'כפול', false: 'שגוי', noise: 'רעש רקע', unclassified: 'ללא סיווג',
};

export const SCENARIO_EXAMPLES = [
  {
    title: 'שריפה בנמל · רמה קלה',
    description: 'שריפה גדולה פורצת במחסן בנמל דג כחול הבדיוני. עשן כבד ופינוי עובדים. צוותי כיבוי מגיעים ונבדקים דיווחים סותרים על מקור השריפה. כל השמות, כלי התקשורת והמקומות מומצאים.',
    name: 'תרגיל שריפה בנמל דג כחול', difficulty: 'easy',
    region: 'נמל דג כחול (בדיוני), צפון ישראל',
    area: { lat_min: 32.6, lat_max: 32.8, long_min: 34.9, long_max: 35.05 },
  },
  {
    title: 'חילוץ באזור תעשייה · רמה בינונית',
    description: 'קריסת גג במפעל באזור התעשייה נחל אורן הבדיוני. צוותי חילוץ ורפואה מפנים עובדים, פרטי הנפגעים עדיין לא ידועים. בהמשך מתקבלים עדכונים ותיקונים ממקורות שונים. כל השמות, כלי התקשורת והמקומות מומצאים.',
    name: 'תרגיל חילוץ בנחל אורן', difficulty: 'medium',
    region: 'אזור התעשייה נחל אורן (בדיוני), מרכז ישראל',
    area: { lat_min: 31.9, lat_max: 32.1, long_min: 34.7, long_max: 34.9 },
  },
  {
    title: 'סערה והצפות · רמה קשה',
    description: 'סערה גורמת להצפות בעיר גבעת ענן הבדיונית. כבישים נסגרים, תושבים מפונים ומתקבלים דיווחים סותרים על הפסקות חשמל ולכודים. כוחות החירום מעדכנים את תמונת המצב לאורך התרגיל. כל השמות, כלי התקשורת והמקומות מומצאים.',
    name: 'תרגיל הצפות בגבעת ענן', difficulty: 'hard',
    region: 'גבעת ענן (בדיונית), דרום ישראל',
    area: { lat_min: 31.2, lat_max: 31.4, long_min: 34.6, long_max: 34.8 },
  },
] satisfies Array<{
  title: string; description: string; name: string; difficulty: AiDifficulty;
  region: string; area: GenerationSettings['area'];
}>;

export function createAiDraft(): AiSimulationDraft {
  const now = new Date().toISOString();
  return {
    version: 1,
    simulation: {
      id: crypto.randomUUID(), name: '', description: '', difficulty: 'medium',
      length_s: 1800, ai_generated: true, target_system: 'specter', reality_id: 1,
    },
    generation: {
      ...DIFFICULTY_PRESETS.medium.generation, region: '', country: 'IL',
      area: { lat_min: null, lat_max: null, long_min: null, long_max: null },
    },
    scenario: '',
    messages: [{
      id: crypto.randomUUID(), role: 'assistant',
      content: 'תארו את התרחיש שמהם ייווצרו הדיווחים. שליחת תיאור אינה משנה את הגדרות הסימולציה; יש למלא אותן בנפרד. בחירת דוגמה מחילה את הגדרות הדוגמה. כל תיאור חדש מחליף את התיאור הפעיל. אין כאן שיחה עם מודל — הפנייה ל-AI מתבצעת רק בעת יצירת הדיווחים.',
    }],
    reports: [], generated_from: null, step: 1, status: 'draft', created_at: now, updated_at: now,
  };
}

export function reportCount(simulation: AiSimulationSettings, generation: GenerationSettings) {
  return Math.round(simulation.length_s / 60 * generation.reports_per_minute);
}

export function generationFingerprint(draft: AiSimulationDraft) {
  return JSON.stringify([draft.scenario, draft.simulation.length_s, draft.generation]);
}

export function validateAiSettings(draft: AiSimulationDraft): string[] {
  const { simulation: s, generation: g } = draft;
  const errors: string[] = [];
  if (draft.scenario.trim().length < 10 || draft.scenario.length > 2000) errors.push('תיאור התרחיש חייב להכיל בין 10 ל-2000 תווים.');
  if (!s.name.trim()) errors.push('נא להזין שם לסימולציה.');
  if (!s.description.trim()) errors.push('נא להזין תיאור לסימולציה.');
  if (!Number.isInteger(s.length_s) || s.length_s < 60 || s.length_s > 7200) errors.push('משך הסימולציה חייב להיות בין 1 ל-120 דקות.');
  if (!Number.isFinite(g.reports_per_minute) || g.reports_per_minute < 0.5 || g.reports_per_minute > 12) errors.push('קצב הדיווחים חייב להיות בין 0.5 ל-12 לדקה.');
  if (reportCount(s, g) > 100) errors.push('שירות ה-AI תומך בעד 100 דיווחים ליצירה. הקטינו את המשך או את הקצב.');
  if (!['low', 'medium', 'high'].includes(g.noise_level)) errors.push('נא לבחור רמת רעש רקע תקינה.');
  if (!g.region.trim() || g.region.length > 200 || !/^[A-Z]{2}$/.test(g.country)) errors.push('נא למלא אזור וקוד מדינה תקינים.');
  const { lat_min, lat_max, long_min, long_max } = g.area;
  if (lat_min === null || lat_max === null || long_min === null || long_max === null
    || ![lat_min, lat_max, long_min, long_max].every(Number.isFinite)
    || lat_min < -90 || lat_max > 90 || lat_min >= lat_max
    || long_min < -180 || long_max > 180 || long_min >= long_max) errors.push('נא למלא גבולות גאוגרפיים תקינים: המינימום חייב להיות קטן מהמקסימום.');
  return errors;
}

export function validateAiReports(draft: AiSimulationDraft): string[] {
  if (draft.reports.length === 0) return ['יש להוסיף לפחות דיווח אחד לפני השמירה.'];
  if (draft.reports.some((r) => !Number.isInteger(r.dispatch_offset_s) || r.dispatch_offset_s < 0 || r.dispatch_offset_s > draft.simulation.length_s)) {
    return ['יש דיווחים מחוץ למשך הסימולציה. עדכנו את העיתוי או צרו מחדש את הדיווחים.'];
  }
  return [];
}

export function formatOffset(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function aiReportTitle(report: AiSimulationReport): string {
  const title = report.payload.report_title || report.payload.original_content.split(/\r?\n/)[0].slice(0, 100) || 'דיווח ללא כותרת';
  return report.origin === 'ai' ? title.replace(/ · \d+$/, '') : title;
}

export function reorderAiReports(reports: AiSimulationReport[], sourceId: string, targetId: string): AiSimulationReport[] {
  const ordered = [...reports].sort((a, b) => a.dispatch_offset_s - b.dispatch_offset_s);
  const source = ordered.findIndex((report) => report.client_id === sourceId);
  const target = ordered.findIndex((report) => report.client_id === targetId);
  if (source < 0 || target < 0) throw new Error('הדיווח להזזה לא נמצא בסימולציה.');
  if (source === target) return reports;
  const slots = ordered.map((report) => report.dispatch_offset_s);
  const [moved] = ordered.splice(source, 1);
  ordered.splice(target, 0, moved);
  return ordered.map((report, index) => ({ ...report, dispatch_offset_s: slots[index] }));
}

async function replyToScenario(draft: AiSimulationDraft, message: string): Promise<AiSimulationDraft> {
  const scenario = message.trim();
  if (scenario.length < 10 || scenario.length > 2000) throw new Error('התיאור חייב להכיל בין 10 ל-2000 תווים.');
  return {
    ...draft, scenario,
    messages: [...draft.messages,
      { id: crypto.randomUUID(), role: 'user', content: scenario },
      { id: crypto.randomUUID(), role: 'assistant', content: 'תיאור התרחיש הפעיל עודכן. הגדרות הסימולציה לא שונו. ליצירת דיווחים חדשים, מלאו את ההגדרות ולחצו על יצירה.' },
    ],
  };
}

export function applyScenarioExample(draft: AiSimulationDraft, example: typeof SCENARIO_EXAMPLES[number]): AiSimulationDraft {
  const preset = DIFFICULTY_PRESETS[example.difficulty];
  return {
    ...draft, scenario: example.description,
    simulation: { ...draft.simulation, name: example.name, description: example.description, difficulty: example.difficulty, length_s: preset.length_s },
    generation: { ...preset.generation, country: 'IL', region: example.region, area: { ...example.area } },
    messages: [...draft.messages,
      { id: crypto.randomUUID(), role: 'user', content: example.description },
      { id: crypto.randomUUID(), role: 'assistant', content: 'הדוגמה נבחרה והגדרות ברירת המחדל שלה הוחלו. אפשר לערוך אותן לפני היצירה.' },
    ],
  };
}

const waitForPoll = (signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const aborted = () => { clearTimeout(timer); reject(new DOMException('Generation polling cancelled.', 'AbortError')); };
  const timer = setTimeout(() => { signal?.removeEventListener('abort', aborted); resolve(); }, 10000);
  if (signal?.aborted) aborted();
  else signal?.addEventListener('abort', aborted, { once: true });
});

async function generateReports(draft: AiSimulationDraft, onProgress?: (status: GenerationStatus) => void, signal?: AbortSignal) {
  const errors = validateAiSettings(draft);
  if (errors.length) throw new Error(errors.join(' '));
  const started = await startAiGeneration({
    description: draft.scenario, region: draft.generation.region, country: draft.generation.country,
    area: draft.generation.area, length_s: draft.simulation.length_s,
    report_count: reportCount(draft.simulation, draft.generation), noise_level: draft.generation.noise_level,
  }, signal);
  onProgress?.(started.status);
  const deadline = Date.now() + 20 * 60 * 1000;
  while (Date.now() < deadline) {
    await waitForPoll(signal);
    const result = await getAiGeneration(started.runId, signal);
    if (result.status === 'failed') throw new Error(result.error);
    if (result.status === 'completed') return result;
    onProgress?.(result.status);
  }
  throw new Error('זמן ההמתנה ליצירת הדיווחים הסתיים. ייתכן שהיצירה ממשיכה בשירות; לא הוחלפו דיווחים קיימים.');
}

export function templateToAiReport(template: LibraryTemplate, minute: number): AiSimulationReport {
  const {
    id, category_id: _categoryId, sub_category_id: _subCategoryId,
    category_name, sub_category_name: _subCategoryName,
    template_created_at: _createdAt, template_updated_at: _updatedAt, ...payload
  } = template;
  return {
    client_id: crypto.randomUUID(), template_id: id, payload: { ...payload, reality_id: 1 },
    dispatch_offset_s: minute * 60, kind: 'original', origin: 'library',
    category_name: category_name ?? 'ספריית תוכן',
  };
}

export const aiSimulationService = { replyToScenario, generateReports };
