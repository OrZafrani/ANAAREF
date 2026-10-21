import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestReports, MOCK_LIBRARY_TEMPLATES } from '../data/aiSimulationFixtures';
import {
  aiReportTitle, aiSimulationService, createAiDraft, DIFFICULTY_PRESETS, formatOffset,
  applyScenarioExample, generationFingerprint, reorderAiReports, SCENARIO_EXAMPLES, templateToAiReport, validateAiReports, validateAiSettings,
} from './aiSimulation';
import { AI_SIMULATIONS_KEY, deleteAiSimulation, loadAiSimulations, saveAiSimulation } from './aiSimulationStorage';
import type { AiSimulationDraft } from '../types/aiSimulation';
import * as api from './api';

function configuredDraft(): AiSimulationDraft {
  const draft = applyScenarioExample(createAiDraft(), SCENARIO_EXAMPLES[1]);
  return { ...draft, scenario: 'תרגיל חילוץ בחיפה ובירושלים', simulation: { ...draft.simulation, name: 'תרגיל', description: 'תרגיל חילוץ מקומי' } };
}

async function generate(draft: AiSimulationDraft) {
  const result = aiSimulationService.generateReports(draft);
  await vi.runAllTimersAsync();
  return (await result).reports;
}

describe('AI generation and draft contracts', () => {
  beforeEach(() => {
    localStorage.clear(); vi.useFakeTimers();
    vi.spyOn(api, 'startAiGeneration').mockResolvedValue({ runId: 'test-run', status: 'queued' });
    vi.spyOn(api, 'getAiGeneration').mockResolvedValue({
      runId: 'test-run', status: 'completed', reports: makeTestReports(configuredDraft()), warnings: [],
    });
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('submits the description and manual settings, polls, and returns only provider reports', async () => {
    const draft = configuredDraft();
    const reports = await generate(draft);
    expect(reports).toHaveLength(60);
    expect(api.startAiGeneration).toHaveBeenCalledWith({
      description: draft.scenario, region: draft.generation.region, country: 'IL', area: draft.generation.area,
      length_s: 1800, report_count: 60, noise_level: 'medium',
    }, undefined);
    expect(api.getAiGeneration).toHaveBeenCalledWith('test-run', undefined);
    expect(reports.map((r) => r.dispatch_offset_s)).toEqual(Array.from({ length: 60 }, (_, i) => i * 30));
    expect(new Set(reports.map((r) => r.client_id)).size).toBe(60);
    expect(new Set(reports.map((r) => r.payload.report_url)).size).toBe(60);
    expect(reports.every((r) => r.payload.reality_id === 1 && r.template_id === null)).toBe(true);
    expect(reports.every((r) => r.payload.collected_at.endsWith('Z') && r.payload.blue_injured_count === null)).toBe(true);
    expect(reports.every((r) => r.kind === 'unclassified')).toBe(true);
    expect(reports.every((r) => !/ · \d+$/.test(r.payload.report_title ?? ''))).toBe(true);
  });

  it('accepts a single valid provider report without requiring the requested count', async () => {
    const reports = makeTestReports(configuredDraft()).slice(0, 1);
    vi.mocked(api.getAiGeneration).mockResolvedValueOnce({
      runId: 'test-run', status: 'completed', reports, warnings: ['Only one valid report'],
    });
    expect(await generate(configuredDraft())).toEqual(reports);
  });

  it('reorders reports between existing time slots without mutating payloads, including tied slots', async () => {
    const reports = (await generate(configuredDraft())).slice(0, 4);
    reports[2] = { ...reports[2], dispatch_offset_s: reports[1].dispatch_offset_s };
    const original = structuredClone(reports);
    const moved = reorderAiReports(reports, reports[0].client_id, reports[3].client_id);
    expect(moved.map((r) => r.client_id)).toEqual([reports[1], reports[2], reports[3], reports[0]].map((r) => r.client_id));
    expect(moved.map((r) => r.dispatch_offset_s)).toEqual([0, 30, 30, 90]);
    expect(moved[3].payload).toEqual(reports[0].payload);
    expect(reports).toEqual(original);
    expect(reorderAiReports(moved, reports[0].client_id, reports[1].client_id).map((r) => r.client_id)).toEqual(reports.map((r) => r.client_id));
    expect(reorderAiReports(reports, reports[0].client_id, reports[0].client_id)).toBe(reports);
    expect(() => reorderAiReports(reports, 'missing', reports[0].client_id)).toThrow('לא נמצא');
  });

  it('accepts 100 reports but rejects 101+ before contacting the API', async () => {
    const draft = configuredDraft();
    const maximum = { ...draft, simulation: { ...draft.simulation, length_s: 6000 }, generation: { ...draft.generation, reports_per_minute: 1 } };
    expect(validateAiSettings(maximum)).toEqual([]);
    vi.mocked(api.getAiGeneration).mockResolvedValueOnce({ runId: 'test-run', status: 'completed', reports: makeTestReports(maximum), warnings: [] });
    expect(await generate(maximum)).toHaveLength(100);
    vi.mocked(api.startAiGeneration).mockClear();
    await expect(aiSimulationService.generateReports({ ...maximum, simulation: { ...maximum.simulation, length_s: 6060 } })).rejects.toThrow('100');
    expect(api.startAiGeneration).not.toHaveBeenCalled();
  });

  it('validates required fields, duration, rate, noise, and geographic bounds', () => {
    expect(validateAiSettings(createAiDraft()).length).toBeGreaterThanOrEqual(3);
    const draft = configuredDraft();
    expect(validateAiSettings(draft)).toEqual([]);
    expect(validateAiSettings({ ...draft, generation: { ...draft.generation, area: { ...draft.generation.area, lat_min: 91 } } }).join(' ')).toContain('גאוגרפיים');
    expect(validateAiSettings({ ...draft, simulation: { ...draft.simulation, length_s: 59 } }).join(' ')).toContain('120');
    expect(validateAiSettings({ ...draft, generation: { ...draft.generation, reports_per_minute: 13 } }).join(' ')).toContain('12');
    expect(validateAiReports(draft)).toHaveLength(1);
  });

  it('replaces the active description without inferring or changing any simulation settings', async () => {
    const draft = configuredDraft();
    const pending = aiSimulationService.replyToScenario(draft, 'תרגיל בשדרות. רמה קשה, 45 דקות');
    await vi.runAllTimersAsync();
    const next = await pending;
    expect(next.simulation).toEqual(draft.simulation);
    expect(next.generation).toEqual(draft.generation);
    expect(next.scenario).not.toContain(draft.scenario);
    expect(next.scenario).toContain('שדרות');
    expect(next.messages[next.messages.length - 2].role).toBe('user');
    expect(generationFingerprint(next)).not.toBe(generationFingerprint(draft));
    expect(generationFingerprint({ ...draft, simulation: { ...draft.simulation, name: 'new' } })).toBe(generationFingerprint(draft));
  });

  it('applies settings only when explicitly choosing an example', () => {
    const draft = applyScenarioExample(createAiDraft(), SCENARIO_EXAMPLES[2]);
    expect(draft.simulation).toMatchObject({ difficulty: 'hard', length_s: DIFFICULTY_PRESETS.hard.length_s, name: SCENARIO_EXAMPLES[2].name });
    expect(draft.generation).toMatchObject({ ...DIFFICULTY_PRESETS.hard.generation, area: SCENARIO_EXAMPLES[2].area });
    expect(validateAiSettings(draft)).toEqual([]);
  });

  it.each([60, 7200])('validates and persists duration boundary %i seconds', (length_s) => {
    const draft = configuredDraft();
    const boundary = { ...draft, simulation: { ...draft.simulation, length_s }, generation: { ...draft.generation, reports_per_minute: 0.5 } };
    expect(validateAiSettings(boundary)).toEqual([]);
    saveAiSimulation(boundary, 'draft');
    expect(loadAiSimulations()[0].simulation.length_s).toBe(length_s);
  });

  it('reports queued/running status, surfaces provider failures, and never falls back to mock reports', async () => {
    vi.mocked(api.getAiGeneration)
      .mockResolvedValueOnce({ runId: 'test-run', status: 'running' })
      .mockResolvedValueOnce({ runId: 'test-run', status: 'failed', error: 'AI quality checks failed' });
    const progress = vi.fn();
    const pending = aiSimulationService.generateReports(configuredDraft(), progress);
    const rejected = expect(pending).rejects.toThrow('quality checks failed');
    await vi.runAllTimersAsync();
    await rejected;
    expect(progress.mock.calls).toEqual([['queued'], ['running']]);
    expect(api.getAiGeneration).toHaveBeenCalledTimes(2);
  });

  it('stops polling on unmount cancellation', async () => {
    const controller = new AbortController();
    const pending = aiSimulationService.generateReports(configuredDraft(), undefined, controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    controller.abort();
    await rejected;
    expect(api.getAiGeneration).not.toHaveBeenCalled();
  });

  it('migrates old percentage-based drafts without overwriting their reports or storage', () => {
    const draft = configuredDraft();
    const old = { ...draft, generation: { reports_per_minute: 4, duplicate_percent: 15, false_percent: 10, noise_percent: 25 }, reports: makeTestReports(draft) };
    const raw = JSON.stringify([old]);
    localStorage.setItem(AI_SIMULATIONS_KEY, raw);
    const migrated = loadAiSimulations()[0];
    expect(migrated.reports).toEqual(old.reports);
    expect(migrated.generation).toMatchObject({ noise_level: 'medium', region: '', area: { lat_min: null } });
    expect(localStorage.getItem(AI_SIMULATIONS_KEY)).toBe(raw);
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
