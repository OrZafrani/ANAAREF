import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_LIBRARY_TEMPLATES } from '../data/aiSimulationFixtures';
import {
  aiReportTitle, aiSimulationService, createAiDraft, DIFFICULTY_PRESETS, formatOffset,
  generationFingerprint, reorderAiReports, templateToAiReport, validateAiReports, validateAiSettings,
} from './aiSimulation';
import { AI_SIMULATIONS_KEY, deleteAiSimulation, loadAiSimulations, saveAiSimulation } from './aiSimulationStorage';
import type { AiSimulationDraft } from '../types/aiSimulation';

function configuredDraft(): AiSimulationDraft {
  const draft = createAiDraft();
  return { ...draft, scenario: 'תרגיל חילוץ בחיפה ובירושלים', simulation: { ...draft.simulation, name: 'תרגיל', description: 'תרגיל חילוץ מקומי' } };
}

async function generate(draft: AiSimulationDraft) {
  const result = aiSimulationService.generateReports(draft);
  await vi.runAllTimersAsync();
  return result;
}

describe('AI frontend mock contracts', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('generates the exact rate/duration count, percentage counts, and valid second offsets', async () => {
    const draft = configuredDraft();
    const reports = await generate(draft);
    expect(reports).toHaveLength(120);
    expect(reports.filter((r) => r.kind === 'original')).toHaveLength(60);
    expect(reports.filter((r) => r.kind === 'duplicate')).toHaveLength(18);
    expect(reports.filter((r) => r.kind === 'false')).toHaveLength(12);
    expect(reports.filter((r) => r.kind === 'noise')).toHaveLength(30);
    expect(reports.map((r) => r.dispatch_offset_s)).toEqual(Array.from({ length: 120 }, (_, i) => i * 15));
    expect(new Set(reports.map((r) => r.client_id)).size).toBe(120);
    expect(new Set(reports.map((r) => r.payload.report_url)).size).toBe(120);
    expect(reports.every((r) => r.payload.reality_id === 1 && r.template_id === null)).toBe(true);
    expect(reports.every((r) => r.payload.collected_at.endsWith('Z') && r.payload.blue_injured_count === null)).toBe(true);
    expect(reports.some((r) => r.payload.city === 'חיפה')).toBe(true);
    expect(reports.some((r) => r.payload.city === 'ירושלים')).toBe(true);
    expect(reports.every((r) => !/ · \d+$/.test(r.payload.report_title ?? ''))).toBe(true);
  });

  it('reorders reports between existing time slots without mutating payloads, including tied slots', async () => {
    const reports = (await generate(configuredDraft())).slice(0, 4);
    reports[2] = { ...reports[2], dispatch_offset_s: reports[1].dispatch_offset_s };
    const original = structuredClone(reports);
    const moved = reorderAiReports(reports, reports[0].client_id, reports[3].client_id);
    expect(moved.map((r) => r.client_id)).toEqual([reports[1], reports[2], reports[3], reports[0]].map((r) => r.client_id));
    expect(moved.map((r) => r.dispatch_offset_s)).toEqual([0, 15, 15, 45]);
    expect(moved[3].payload).toEqual(reports[0].payload);
    expect(reports).toEqual(original);
    expect(reorderAiReports(moved, reports[0].client_id, reports[1].client_id).map((r) => r.client_id)).toEqual(reports.map((r) => r.client_id));
    expect(reorderAiReports(reports, reports[0].client_id, reports[0].client_id)).toBe(reports);
    expect(() => reorderAiReports(reports, 'missing', reports[0].client_id)).toThrow('לא נמצא');
  });

  it('supports minimum and maximum generation sizes within simulation duration', async () => {
    const draft = configuredDraft();
    const minimum = await generate({ ...draft, simulation: { ...draft.simulation, length_s: 600 }, generation: { ...draft.generation, reports_per_minute: 0.5 } });
    expect(minimum).toHaveLength(5);
    const maximum = await generate({ ...draft, simulation: { ...draft.simulation, length_s: 7200 }, generation: { ...draft.generation, reports_per_minute: 12 } });
    expect(maximum).toHaveLength(1440);
    expect(maximum[maximum.length - 1].dispatch_offset_s).toBeLessThan(7200);
  });

  it('validates required fields, duration, rate, and the combined distraction budget', () => {
    expect(validateAiSettings(createAiDraft())).toHaveLength(3);
    const draft = configuredDraft();
    expect(validateAiSettings(draft)).toEqual([]);
    expect(validateAiSettings({ ...draft, generation: { ...draft.generation, duplicate_percent: 50, false_percent: 50 } }).join(' ')).toContain('100%');
    expect(validateAiSettings({ ...draft, simulation: { ...draft.simulation, length_s: 599 } }).join(' ')).toContain('120');
    expect(validateAiSettings({ ...draft, generation: { ...draft.generation, reports_per_minute: 13 } }).join(' ')).toContain('12');
    expect(validateAiReports(draft)).toHaveLength(1);
  });

  it('updates supported chat settings while keeping manual name/description edits and all context', async () => {
    const draft = configuredDraft();
    const pending = aiSimulationService.replyToScenario(draft, 'תרגיל בשדרות. רמה קשה, 45 דקות');
    await vi.runAllTimersAsync();
    const next = await pending;
    expect(next.simulation).toMatchObject({ name: draft.simulation.name, description: draft.simulation.description, difficulty: 'hard', length_s: 2700 });
    expect(next.generation).toEqual(DIFFICULTY_PRESETS.hard.generation);
    expect(next.scenario).toContain(draft.scenario);
    expect(next.scenario).toContain('שדרות');
    expect(next.messages[next.messages.length - 2].role).toBe('user');
    expect(generationFingerprint(next)).not.toBe(generationFingerprint(draft));
    expect(generationFingerprint({ ...draft, simulation: { ...draft.simulation, name: 'new' } })).toBe(generationFingerprint(draft));
  });

  it('copies complete library payloads without mutating templates or conflating null and zero', () => {
    const template = structuredClone(MOCK_LIBRARY_TEMPLATES[0]);
    const report = templateToAiReport(template, 1.5);
    expect(aiReportTitle({ ...report, origin: 'ai', payload: { ...report.payload, report_title: 'תרגיל · חיפה · 12' } })).toBe('תרגיל · חיפה');
    expect(aiReportTitle({ ...report, payload: { ...report.payload, report_title: 'תרגיל · 12' } })).toBe('תרגיל · 12');
    expect(aiReportTitle({ ...report, origin: 'ai', payload: { ...report.payload, report_title: 'אירוע בכביש 90' } })).toBe('אירוע בכביש 90');
    expect(report).toMatchObject({ template_id: template.id, dispatch_offset_s: 90, origin: 'library', payload: { blue_death_count: 0, blue_injured_count: null, city: 'חיפה', reality_id: 1 } });
    report.payload.report_title = 'edited';
    expect(template.report_title).not.toBe('edited');
    expect(report.payload).not.toHaveProperty('matches');
    expect(validateAiReports({ ...configuredDraft(), reports: [{ ...report, dispatch_offset_s: 9999 }] })).toHaveLength(1);
    expect(formatOffset(90)).toBe('01:30');
  });

  it('persists and upserts full drafts without touching manual simulations, then deletes only the requested AI draft', async () => {
    localStorage.setItem('cobra_simulations', '[{"id":"manual-1"}]');
    const draft = configuredDraft();
    const reports = await generate(draft);
    saveAiSimulation({ ...draft, reports, generated_from: generationFingerprint(draft), step: 2 }, 'draft');
    expect(loadAiSimulations()[0].reports).toEqual(reports);
    saveAiSimulation({ ...draft, reports, step: 3 }, 'saved');
    expect(loadAiSimulations()).toHaveLength(1);
    expect(loadAiSimulations()[0].status).toBe('saved');
    expect(localStorage.getItem('cobra_simulations')).toBe('[{"id":"manual-1"}]');
    deleteAiSimulation(draft.simulation.id);
    expect(loadAiSimulations()).toEqual([]);
  });

  it('rejects corrupt local data rather than silently replacing it', () => {
    localStorage.setItem(AI_SIMULATIONS_KEY, '[{"version":99}]');
    expect(() => loadAiSimulations()).toThrow('אינם תקינים');
    expect(() => saveAiSimulation(configuredDraft(), 'draft')).toThrow('אינם תקינים');
    expect(localStorage.getItem(AI_SIMULATIONS_KEY)).toBe('[{"version":99}]');
  });

  it('surfaces storage write failures', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
    expect(() => saveAiSimulation(configuredDraft(), 'draft')).toThrow('Quota exceeded');
  });
});
