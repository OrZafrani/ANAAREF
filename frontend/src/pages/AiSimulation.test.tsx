import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AiSimulation from './AiSimulation';
import Home from './Home';
import { aiSimulationService } from '../lib/aiSimulation';
import { AI_SIMULATIONS_KEY, loadAiSimulations } from '../lib/aiSimulationStorage';
import { makeTestReports, MOCK_LIBRARY_CATEGORIES, MOCK_LIBRARY_TEMPLATES } from '../data/aiSimulationFixtures';
import * as libraryApi from '../lib/libraryApi';
import type { CreateAiSimulationInput } from '../lib/api';
import type { Simulation } from '../types/simulation';

function renderBuilder(path = '/simulations/ai') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/simulations/ai" element={<AiSimulation />} />
        <Route path="/simulations/new" element={<p>Manual builder unchanged</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function makeReports(expectedCount = 5) {
  if (!screen.getByLabelText(/שם הסימולציה/).getAttribute('value')) {
    fireEvent.change(screen.getByLabelText(/שם הסימולציה/), { target: { value: 'תרגיל AI מקומי' } });
  }
  fireEvent.change(screen.getByLabelText(/תיאור הסימולציה/), { target: { value: 'תרגיל חילוץ לבדיקה' } });
  fireEvent.change(screen.getByLabelText('אזור התרחיש'), { target: { value: 'אזור בדיקה בדיוני' } });
  for (const [label, value] of [
    ['קו רוחב מינימלי', '32.6'], ['קו רוחב מקסימלי', '32.8'], ['קו אורך מינימלי', '34.9'], ['קו אורך מקסימלי', '35.05'],
  ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.change(screen.getByLabelText('הודעה לעוזר הסימולציה'), { target: { value: 'תרגיל חילוץ בחיפה' } });
  fireEvent.click(screen.getByRole('button', { name: 'שליחה' }));
  await screen.findByText('אתם');
  fireEvent.change(screen.getByRole('slider', { name: /קצב הזרמת דיווחים/ }), { target: { value: '0.5' } });
  fireEvent.change(screen.getByRole('slider', { name: /משך הסימולציה/ }), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'יצירת הסימולציה' }));
  await screen.findByRole('heading', { name: new RegExp(`דיווחים בסימולציה ${expectedCount}`) });
}

describe('AI simulation frontend flow', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.spyOn(aiSimulationService, 'generateReports').mockImplementation(async (draft) => ({
      runId: 'test-run', status: 'completed', reports: makeTestReports(draft), warnings: [],
    }));
    let storedSimulation: Simulation | undefined;
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/simulations' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as CreateAiSimulationInput;
        storedSimulation = {
          id: 'saved-simulation', title: body.title, description: body.description, difficulty: body.difficulty,
          sys: 'spectre', createdAt: new Date().toISOString(), aiGenerated: true, lengthSeconds: body.length_s,
          events: body.reports.map((report) => ({
            id: report.client_id, title: report.payload.report_title ?? '', description: report.payload.original_content,
            category: 'מבצעי', minute: report.dispatch_offset_s / 60,
          })),
        };
        return Promise.resolve(new Response(JSON.stringify({ id: storedSimulation.id, createdAt: storedSimulation.createdAt }), { status: 201 }));
      }
      if (String(input) === '/api/simulations') return Promise.resolve(new Response(JSON.stringify(storedSimulation ? [storedSimulation] : [])));
      if (init?.method && init.method !== 'GET') return Promise.reject(new Error('Unexpected backend write'));
      if (String(input) === '/api/categories/tree') return Promise.resolve(new Response(JSON.stringify(MOCK_LIBRARY_CATEGORIES)));
      if (String(input) === '/api/templates') return Promise.resolve(new Response(JSON.stringify(MOCK_LIBRARY_TEMPLATES)));
      return Promise.reject(new Error(`Unexpected backend request: ${String(input)}`));
    }));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it.each([
    { warnings: [] },
    { warnings: ['Quality check details', 'every row has trigger matches'] },
  ])('shows only the success message after generation with warnings $warnings', async ({ warnings }) => {
    vi.mocked(aiSimulationService.generateReports).mockImplementationOnce(async (draft) => ({
      runId: 'test-run', status: 'completed', reports: makeTestReports(draft), warnings,
    }));
    renderBuilder();
    await makeReports();
    expect(screen.getByText('הדיווחים נוצרו בהצלחה')).toHaveTextContent(/^הדיווחים נוצרו בהצלחה$/);
    expect(screen.queryByText(/Quality check details|every row has trigger matches|הערות בדיקת האיכות/)).not.toBeInTheDocument();
  });

  it('opens AI creation from the existing modal and keeps the manual entry working', () => {
    renderBuilder('/');
    fireEvent.click(screen.getByRole('button', { name: /סימולציה חדשה/ }));
    const manual = screen.getByRole('button', { name: /יצירה ידנית/ });
    expect(manual).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('button', { name: /יצירה אוטומטית/ }));
    expect(screen.getByText('בונה AI · סימולציה חדשה')).toBeInTheDocument();
    expect(screen.getByRole('log')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /בדיקה ועריכה/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /סימולציה חדשה/ }));
    fireEvent.click(screen.getByRole('button', { name: /יצירה ידנית/ }));
    expect(screen.getByText('Manual builder unchanged')).toBeInTheDocument();
  });

  it('does not infer settings from a free description, while examples apply explicit defaults', async () => {
    renderBuilder();
    const durationSlider = screen.getByRole('slider', { name: /משך הסימולציה/ });
    expect(durationSlider).toHaveAttribute('min', '1');
    expect(durationSlider).toHaveAttribute('max', '120');
    expect(screen.getByRole('group', { name: 'רמת רעש רקע' })).toBeInTheDocument();
    expect(screen.getByText('מתאר את כמות הדיווחים שאינם קשורים לאירוע המרכזי אותו בוחנים')).toBeInTheDocument();
    const freeDescription = 'שריפה בדיונית בנמל. רמה קשה, 45 דקות, בלי לשנות הגדרות.';
    fireEvent.change(screen.getByLabelText('הודעה לעוזר הסימולציה'), { target: { value: freeDescription } });
    fireEvent.click(screen.getByRole('button', { name: 'שליחה' }));
    await screen.findByText('אתם');
    expect(screen.getByLabelText(/שם הסימולציה/)).toHaveValue('');
    expect(screen.getByLabelText(/תיאור הסימולציה/)).toHaveValue('');
    expect(screen.getByLabelText('אזור התרחיש')).toHaveValue('');
    expect(screen.getByRole('slider', { name: /משך הסימולציה/ })).toHaveValue('30');
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'יצירת הסימולציה' }));
    expect(screen.getByRole('alert')).toHaveTextContent('שם לסימולציה');
    expect(aiSimulationService.generateReports).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('דוגמאות לתרחישים · בחירה תחיל את הגדרות הדוגמה'));
    fireEvent.click(screen.getByRole('button', { name: 'שריפה בנמל · רמה קלה' }));
    expect(screen.getByLabelText(/שם הסימולציה/)).toHaveValue('תרגיל שריפה בנמל דג כחול');
    expect(screen.getByRole('slider', { name: /משך הסימולציה/ })).toHaveValue('20');
    expect(screen.getByLabelText('קו רוחב מינימלי')).toHaveValue(32.6);
    expect(screen.getByRole('button', { name: 'נמוכה' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByRole('slider', { name: /קצב הזרמת דיווחים/ }), { target: { value: '12' } });
    expect(screen.getByText('240 דיווחים מתוכננים')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'יצירת הסימולציה' })).toBeDisabled();
    expect(aiSimulationService.generateReports).not.toHaveBeenCalled();
  });

  it('accepts a replacement description and only replaces reports after confirmed successful generation', async () => {
    renderBuilder();
    await makeReports();
    fireEvent.click(screen.getAllByRole('button', { name: /^עריכת דיווח:/ })[0]);
    const editor = screen.getByRole('dialog');
    fireEvent.change(within(editor).getByLabelText('כותרת'), { target: { value: 'עריכה לשמירה עד הצלחה' } });
    fireEvent.click(within(editor).getByRole('button', { name: 'שמירת שינויים' }));
    fireEvent.click(screen.getByRole('button', { name: 'תיאור חדש ויצירה מחדש' }));
    const newDescription = 'תרחיש חדש: הצפות בשכונה בדיונית ופינוי תושבים. כל השמות מומצאים.';
    fireEvent.change(screen.getByLabelText('הודעה לעוזר הסימולציה'), { target: { value: newDescription } });
    fireEvent.click(screen.getByRole('button', { name: 'שליחה' }));
    await waitFor(() => expect(screen.getByLabelText('הודעה לעוזר הסימולציה')).toHaveValue(''));
    expect(screen.getByLabelText(/שם הסימולציה/)).toHaveValue('תרגיל AI מקומי');
    expect(screen.getByRole('slider', { name: /משך הסימולציה/ })).toHaveValue('10');
    fireEvent.click(screen.getByRole('button', { name: 'יצירת הסימולציה מחדש' }));
    fireEvent.click(screen.getByRole('button', { name: 'ביטול יצירה מחדש' }));
    expect(aiSimulationService.generateReports).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'שמירה כטיוטה' }));
    expect(loadAiSimulations()[0].reports[0].payload.report_title).toBe('עריכה לשמירה עד הצלחה');
    fireEvent.click(screen.getByRole('button', { name: 'יצירת הסימולציה מחדש' }));
    fireEvent.click(screen.getByRole('button', { name: 'החלפת הדיווחים' }));
    await screen.findByRole('heading', { name: /דיווחים בסימולציה 5/ });
    expect(screen.queryByText('עריכה לשמירה עד הצלחה')).not.toBeInTheDocument();
    const calls = vi.mocked(aiSimulationService.generateReports).mock.calls;
    expect(calls[calls.length - 1][0].scenario).toBe(newDescription);
    expect(aiSimulationService.generateReports).toHaveBeenCalledTimes(2);
  });

  it('generates, edits, copies a library template, removes a report, and saves to the database dashboard', async () => {
    renderBuilder();
    fireEvent.change(screen.getByLabelText(/שם הסימולציה/), { target: { value: 'תרגיל AI מקומי' } });
    await makeReports();
    fireEvent.click(screen.getAllByRole('button', { name: /^עריכת דיווח:/ })[0]);
    const editor = screen.getByRole('dialog', { name: 'עריכת דיווח בסימולציה' });
    expect(within(editor).getByLabelText('דקות')).toHaveAccessibleDescription('שינוי העיתוי יעדכן את מיקום הדיווח ברשימה לאחר השמירה.');
    fireEvent.change(within(editor).getByLabelText('כותרת'), { target: { value: 'דיווח שנערך' } });
    fireEvent.change(within(editor).getByLabelText('פצועים — כוחותינו'), { target: { value: '0' } });
    fireEvent.change(within(editor).getByLabelText('דקות'), { target: { value: '1' } });
    fireEvent.change(within(editor).getByLabelText('שניות'), { target: { value: '30' } });
    fireEvent.click(within(editor).getByRole('button', { name: 'שמירת שינויים' }));
    expect(screen.getByText('דיווח שנערך')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'הוספה מהספרייה' }));
    await screen.findByRole('button', { name: 'הוסף לסימולציה: צוותי חילוץ הגיעו לאזור התרגיל' });
    fireEvent.change(screen.getByLabelText('דקה בסימולציה: צוותי חילוץ הגיעו לאזור התרגיל'), { target: { value: '11' } });
    expect(screen.getByRole('button', { name: 'הוסף לסימולציה: צוותי חילוץ הגיעו לאזור התרגיל' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'הוסף לסימולציה: צוותי חילוץ הגיעו לאזור התרגיל' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('דקה בסימולציה: צוותי חילוץ הגיעו לאזור התרגיל'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'הוסף לסימולציה: צוותי חילוץ הגיעו לאזור התרגיל' }));
    fireEvent.click(screen.getByRole('button', { name: 'סיום והמשך' }));
    expect(screen.getByRole('heading', { name: /דיווחים בסימולציה 6/ })).toBeInTheDocument();
    const remove = screen.getAllByRole('button', { name: /^הסרת דיווח:/ }).find((button) => !button.getAttribute('aria-label')?.includes('דיווח שנערך') && !button.getAttribute('aria-label')?.includes('צוותי חילוץ'));
    expect(remove).toBeDefined();
    if (remove) fireEvent.click(remove);
    fireEvent.click(screen.getByRole('button', { name: 'המשך לשמירה' }));
    expect(screen.getByRole('heading', { name: 'סקירה ושמירה' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'שמירת הסימולציה' }));
    await screen.findByRole('heading', { name: 'הסימולציה נשמרה בהצלחה' });
    expect(loadAiSimulations()).toHaveLength(0);
    const post = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST');
    expect(post?.[0]).toBe('/api/simulations');
    const saved = JSON.parse(String(post?.[1]?.body)) as CreateAiSimulationInput;
    expect(saved).toMatchObject({ title: 'תרגיל AI מקומי', ai_generated: true, length_s: 600, sys: 'spectre', difficulty: 'בינוני' });
    expect(saved.reports).toHaveLength(5);
    expect(saved.reports.find((report) => report.payload.report_title === 'דיווח שנערך')).toMatchObject({
      dispatch_offset_s: 90, payload: { blue_injured_count: 0, red_injured_count: null },
    });
    expect(saved.reports.find((report) => report.template_id === MOCK_LIBRARY_TEMPLATES[0].id)).toMatchObject({
      dispatch_offset_s: 120, payload: { platform: 'telegram', city: 'חיפה', lat: 32.794, blue_death_count: 0, blue_injured_count: null },
    });
    expect(saved.reports.every((report) => !('matches' in report.payload))).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenCalledWith('/api/categories/tree', expect.any(Object));
    expect(fetch).toHaveBeenCalledWith('/api/templates', expect.any(Object));
    const success = screen.getByRole('dialog', { name: 'הסימולציה נשמרה בהצלחה' });
    expect(success).toHaveTextContent('תרגיל AI מקומי');
    expect(success).toHaveTextContent('5 אירועים');
    expect(within(success).getByRole('button', { name: 'יצירת סימולציה נוספת' })).toBeInTheDocument();
    fireEvent.click(within(success).getByRole('button', { name: 'חזרה ללוח הבקרה' }));
    fireEvent.click(await screen.findByRole('button', { name: 'תרגיל AI מקומי' }));
    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByText('דיווח שנערך')).toBeInTheDocument();
    expect(within(drawer).getByText('T+01:30')).toBeInTheDocument();
    expect(within(drawer).getByText('10')).toBeInTheDocument();
  });

  it('reviews and saves a single valid report even when five were requested', async () => {
    vi.mocked(aiSimulationService.generateReports).mockImplementationOnce(async (draft) => ({
      runId: 'test-run', status: 'completed', reports: makeTestReports(draft).slice(0, 1),
      warnings: ['AI quality checks failed. valid first call >= 90%', 'Skipped invalid AI CSV row 2'],
    }));
    renderBuilder();
    await makeReports(1);
    expect(screen.getAllByRole('button', { name: /^הסרת דיווח:/ })).toHaveLength(1);
    expect(screen.getByText('הדיווחים נוצרו בהצלחה')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'המשך לשמירה' }));
    expect(screen.getByRole('heading', { name: 'סקירה ושמירה' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'שמירת הסימולציה' }));
    await screen.findByRole('heading', { name: 'הסימולציה נשמרה בהצלחה' });
    const post = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST');
    const saved = JSON.parse(String(post?.[1]?.body)) as CreateAiSimulationInput;
    expect(saved.reports).toHaveLength(1);
    expect(saved.length_s).toBe(600);
  });

  it('guards both save buttons during a database request and removes the local draft only after success', async () => {
    renderBuilder();
    await makeReports();
    fireEvent.click(screen.getByRole('button', { name: 'שמירה כטיוטה' }));
    const localDraft = loadAiSimulations()[0];
    let complete!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>((resolve) => { complete = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: 'המשך לשמירה' }));
    const headerSave = screen.getByRole('button', { name: 'שמירה' });
    const finalSave = screen.getByRole('button', { name: 'שמירת הסימולציה' });
    fireEvent.click(headerSave);
    fireEvent.click(finalSave);
    expect(headerSave).toBeDisabled();
    expect(finalSave).toBeDisabled();
    expect(finalSave).toHaveTextContent('שומר…');
    expect(finalSave.querySelector('.ai-save-spinner')).toBeInTheDocument();
    const progress = screen.getByRole('status');
    expect(progress).toHaveClass('ai-save-progress');
    expect(progress).toHaveTextContent('שומר את הסימולציה…');
    expect(progress.querySelector('.ai-save-spinner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'סגירה' })).toBeDisabled();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(loadAiSimulations()[0].simulation.id).toBe(localDraft.simulation.id);
    complete(new Response(JSON.stringify({ id: 'database-id', createdAt: new Date().toISOString() }), { status: 201 }));
    await screen.findByRole('heading', { name: 'הסימולציה נשמרה בהצלחה' });
    expect(loadAiSimulations()).toHaveLength(0);
    expect(screen.queryByText('שומר את הסימולציה…')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'שמירה' })).not.toBeInTheDocument();
  });

  it('keeps edits and the local draft when saving fails, then allows retry', async () => {
    renderBuilder();
    await makeReports();
    fireEvent.click(screen.getByRole('button', { name: 'שמירה כטיוטה' }));
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Database unavailable' }), { status: 503 }));
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
    expect(screen.queryByText('שומר את הסימולציה…')).not.toBeInTheDocument();
    expect(loadAiSimulations()).toHaveLength(1);
    expect(screen.getAllByRole('article')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'שמירה' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    await screen.findByRole('heading', { name: 'הסימולציה נשמרה בהצלחה' });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(loadAiSimulations()).toHaveLength(0);
  });

  it('starts a fresh AI simulation from the shared save-success popup', async () => {
    renderBuilder();
    await makeReports();
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    const popup = await screen.findByRole('dialog', { name: 'הסימולציה נשמרה בהצלחה' });
    expect(popup).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(within(popup).getByRole('button', { name: 'יצירת סימולציה נוספת' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('log')).toBeInTheDocument();
    expect(screen.getByLabelText(/שם הסימולציה/)).toHaveValue('');
    expect(within(screen.getByRole('log')).getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /בדיקה ועריכה/ })).toBeDisabled();
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not turn local cleanup failure into a failed database save', async () => {
    renderBuilder();
    await makeReports();
    fireEvent.click(screen.getByRole('button', { name: 'שמירה כטיוטה' }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('Storage blocked'); });
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    await screen.findByRole('heading', { name: 'הסימולציה נשמרה בהצלחה' });
    expect(screen.getByRole('alert')).toHaveTextContent('מחיקת הטיוטה המקומית נכשלה');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'שמירה' })).not.toBeInTheDocument();
  });

  it('edits minutes and seconds, validates duration, and repositions the report precisely', async () => {
    renderBuilder();
    await makeReports();
    const firstTitle = within(screen.getAllByRole('article')[0]).getByRole('heading').textContent;
    fireEvent.click(screen.getAllByRole('button', { name: /^עריכת דיווח:/ })[0]);
    let editor = screen.getByRole('dialog', { name: 'עריכת דיווח בסימולציה' });
    const minutes = within(editor).getByLabelText('דקות');
    const seconds = within(editor).getByLabelText('שניות');
    expect(minutes).toHaveValue(0);
    expect(seconds).toHaveValue(0);
    const submit = () => {
      const form = minutes.closest('form');
      if (!form) throw new Error('Missing editor form');
      fireEvent.submit(form);
    };
    for (const value of ['60', '-1', '1.5']) {
      fireEvent.change(seconds, { target: { value } });
      submit();
      expect(within(editor).getByRole('alert')).toHaveTextContent('שניות בין 0 ל-59');
    }
    fireEvent.change(minutes, { target: { value: '10' } });
    fireEvent.change(seconds, { target: { value: '1' } });
    submit();
    expect(within(editor).getByRole('alert')).toHaveTextContent('בתוך משך הסימולציה');
    fireEvent.change(minutes, { target: { value: '3' } });
    fireEvent.change(seconds, { target: { value: '17' } });
    fireEvent.click(within(editor).getByRole('button', { name: 'שמירת שינויים' }));
    let cards = screen.getAllByRole('article');
    expect(within(cards[1]).getByRole('heading')).toHaveTextContent(firstTitle ?? '');
    expect(within(cards[1]).getByText('T+03:17')).toBeInTheDocument();
    fireEvent.click(within(cards[1]).getByRole('button', { name: /^עריכת דיווח:/ }));
    editor = screen.getByRole('dialog', { name: 'עריכת דיווח בסימולציה' });
    expect(within(editor).getByLabelText('דקות')).toHaveValue(3);
    expect(within(editor).getByLabelText('שניות')).toHaveValue(17);
    fireEvent.change(within(editor).getByLabelText('דקות'), { target: { value: '10' } });
    fireEvent.change(within(editor).getByLabelText('שניות'), { target: { value: '0' } });
    fireEvent.click(within(editor).getByRole('button', { name: 'שמירת שינויים' }));
    cards = screen.getAllByRole('article');
    expect(within(cards[4]).getByRole('heading')).toHaveTextContent(firstTitle ?? '');
    expect(within(cards[4]).getByText('T+10:00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'שמירה כטיוטה' }));
    expect(loadAiSimulations()[0].reports.find((report) => report.payload.report_title === firstTitle)?.dispatch_offset_s).toBe(600);
  });

  it('shows a real library loading error and retries when reopened without a demo fallback', async () => {
    vi.spyOn(libraryApi, 'getTemplates').mockRejectedValueOnce(new Error('library unavailable'));
    renderBuilder();
    await makeReports();
    fireEvent.click(screen.getByRole('button', { name: 'הוספה מהספרייה' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('library unavailable');
    expect(screen.queryByRole('button', { name: 'הוסף לסימולציה: צוותי חילוץ הגיעו לאזור התרגיל' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'סיום והמשך' }));
    fireEvent.click(screen.getByRole('button', { name: 'הוספה מהספרייה' }));
    expect(await screen.findByRole('button', { name: 'הוסף לסימולציה: צוותי חילוץ הגיעו לאזור התרגיל' })).toBeEnabled();
    expect(fetch).toHaveBeenCalledWith('/api/templates', expect.any(Object));
  });

  it('shows every API template, including reports outside the demo library, and refreshes on reopen', async () => {
    const realTemplate = {
      ...MOCK_LIBRARY_TEMPLATES[0],
      id: 'server-only-report',
      report_title: 'דיווח נוסף מהמאגר',
      original_content: 'תוכן שהגיע מהשרת ולא מנתוני ההדגמה',
    };
    const templates = vi.spyOn(libraryApi, 'getTemplates').mockResolvedValue([...MOCK_LIBRARY_TEMPLATES, realTemplate]);
    renderBuilder();
    await makeReports();
    fireEvent.click(screen.getByRole('button', { name: 'הוספה מהספרייה' }));
    expect(await screen.findByRole('button', { name: 'הוסף לסימולציה: דיווח נוסף מהמאגר' })).toBeEnabled();
    expect(screen.getByText('3 דיווחים מהמאגר (3 מוצגים)')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'חיפוש בספריית הדיווחים' }), { target: { value: 'תוכן שהגיע מהשרת' } });
    expect(screen.getByText('3 דיווחים מהמאגר (1 מוצגים)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'הוסף לסימולציה: דיווח נוסף מהמאגר' }));
    fireEvent.click(screen.getByRole('button', { name: 'סיום והמשך' }));
    fireEvent.click(screen.getByRole('button', { name: 'שמירה כטיוטה' }));
    expect(loadAiSimulations()[0].reports.find((report) => report.template_id === realTemplate.id)).toMatchObject({
      origin: 'library', dispatch_offset_s: 60,
      payload: { original_content: realTemplate.original_content, blue_death_count: 0, blue_injured_count: null, reality_id: 1 },
    });
    expect(realTemplate.original_content).toBe('תוכן שהגיע מהשרת ולא מנתוני ההדגמה');
    templates.mockResolvedValue([realTemplate]);
    fireEvent.click(screen.getByRole('button', { name: 'הוספה מהספרייה' }));
    expect(await screen.findByText('1 דיווחים מהמאגר (1 מוצגים)')).toBeInTheDocument();
    expect(templates).toHaveBeenCalledTimes(2);
  });

  it('drags reports between delivery slots and persists the reordered list', async () => {
    const view = renderBuilder();
    await makeReports();
    const cards = screen.getAllByRole('article');
    const orderGroup = within(cards[0]).getByRole('group', { name: 'עיתוי וסדר הדיווח' });
    expect(within(orderGroup).getByText('T+00:00')).toBeInTheDocument();
    expect(within(orderGroup).getByRole('button', { name: /^הזזת דיווח:/ })).toBeEnabled();
    expect(orderGroup).toHaveAttribute('title', 'גרירה משנה את עיתוי הדיווח בסימולציה');
    const titles = cards.map((card) => within(card).getByRole('heading').textContent);
    expect(titles.every((title) => !/ · \d+$/.test(title ?? ''))).toBe(true);
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(within(cards[0]).getByRole('button', { name: /^הזזת דיווח:/ }), { dataTransfer });
    fireEvent.dragOver(cards[2], { dataTransfer });
    expect(cards[2]).toHaveClass('ai-report-drop-target');
    fireEvent.drop(cards[2], { dataTransfer });
    const reordered = screen.getAllByRole('article');
    expect(reordered.map((card) => within(card).getByRole('heading').textContent)).toEqual([titles[1], titles[2], titles[0], titles[3], titles[4]]);
    expect(reordered.map((card) => within(card).getByText(/^T\+/).textContent)).toEqual(['T+00:00', 'T+02:00', 'T+04:00', 'T+06:00', 'T+08:00']);
    fireEvent.click(screen.getByRole('button', { name: 'שמירה כטיוטה' }));
    const saved = loadAiSimulations()[0];
    expect(saved.reports.map((r) => r.payload.report_title)).toEqual([titles[1], titles[2], titles[0], titles[3], titles[4]]);
    view.unmount();
    renderBuilder(`/simulations/ai?id=${saved.simulation.id}`);
    expect(screen.getAllByRole('article').map((card) => within(card).getByRole('heading').textContent)).toEqual(saved.reports.map((r) => r.payload.report_title));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('supports move buttons and disables reordering in filtered views', async () => {
    renderBuilder();
    await makeReports();
    const cards = screen.getAllByRole('article');
    const firstTitle = within(cards[0]).getByRole('heading').textContent;
    expect(within(cards[0]).getByRole('button', { name: /^העברה למעלה:/ })).toBeDisabled();
    expect(within(cards[4]).getByRole('button', { name: /^העברה למטה:/ })).toBeDisabled();
    fireEvent.click(within(cards[0]).getByRole('button', { name: /^העברה למטה:/ }));
    expect(within(screen.getAllByRole('article')[1]).getByRole('heading')).toHaveTextContent(firstTitle ?? '');
    fireEvent.click(screen.getByRole('button', { name: /^ללא סיווג \(/ }));
    expect(screen.getAllByRole('button', { name: /^הזזת דיווח:/ }).every((button) => button.hasAttribute('disabled'))).toBe(true);
    expect(screen.getByText(/לשינוי סדר הדיווחים, בחרו/)).toBeInTheDocument();
  });

  it('opens report details, preserves zero versus unknown, and supports editing and removal', async () => {
    renderBuilder();
    await makeReports();
    const detailsButton = screen.getAllByRole('button', { name: /^פרטים:/ })[0];
    detailsButton.focus();
    fireEvent.click(detailsButton);
    let dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'מידע מרכזי' })).toBeInTheDocument();
    expect(within(dialog).getByText('זמן התרחשות')).toBeInTheDocument();
    expect(within(dialog).getByText('מקור מידע')).toBeInTheDocument();
    expect(within(dialog).getByText('פצועים — כוחותינו').nextElementSibling).toHaveTextContent('לא ידוע');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(detailsButton).toHaveFocus();
    fireEvent.click(detailsButton);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'עריכה' }));
    dialog = screen.getByRole('dialog', { name: 'עריכת דיווח בסימולציה' });
    fireEvent.change(within(dialog).getByLabelText('פצועים — כוחותינו'), { target: { value: '0' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'שמירת שינויים' }));
    fireEvent.click(screen.getAllByRole('button', { name: /^פרטים:/ })[0]);
    dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('פצועים — כוחותינו').nextElementSibling).toHaveTextContent(/^0$/);
    expect(within(dialog).getByText('הרוגים — אויב').nextElementSibling).toHaveTextContent('לא ידוע');
    fireEvent.click(within(dialog).getByText(/פרטים נוספים/));
    expect(within(dialog).getByText('גרסת סכמה')).toBeVisible();
    expect(within(dialog).getByText('כתובת מקור')).toBeVisible();
    const close = within(dialog).getByRole('button', { name: 'סגירה' });
    close.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(within(dialog).getByRole('button', { name: 'סגירת פרטי הדיווח' })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(close).toHaveFocus();
    fireEvent.click(within(dialog).getByRole('button', { name: 'הסרה מהסימולציה' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /דיווחים בסימולציה 4/ })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('restores header actions, saves a partial draft, and keeps final-step saving', async () => {
    const view = renderBuilder();
    expect(screen.getByRole('button', { name: 'שמירה כטיוטה' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'שמירה' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'סגירה' })).toBeEnabled();
    expect(screen.getByText('טרם נשמר')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    expect(screen.getByRole('alert')).toHaveTextContent('יש להוסיף לפחות דיווח אחד');
    expect(loadAiSimulations()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'שמירה כטיוטה' }));
    await waitFor(() => expect(screen.getByText('נשמר מקומית')).toBeInTheDocument());
    expect(loadAiSimulations()[0]).toMatchObject({ status: 'draft', step: 1, reports: [] });
    await makeReports();
    expect(screen.getByRole('button', { name: 'שמירה כטיוטה' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'המשך לשמירה' }));
    expect(screen.getAllByRole('button', { name: 'שמירה כטיוטה' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'שמירת הסימולציה' })).toHaveLength(1);
    fireEvent.click(screen.getAllByRole('button', { name: 'שמירה כטיוטה' })[1]);
    const saved = loadAiSimulations()[0];
    expect(saved.status).toBe('draft');
    expect(saved.simulation).toMatchObject({ difficulty: 'medium', length_s: 600 });
    expect(saved.reports).toHaveLength(5);
    view.unmount();
    renderBuilder(`/simulations/ai?id=${saved.simulation.id}`);
    expect(screen.getByRole('heading', { name: 'סקירה ושמירה' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'עריכת הגדרות' }));
    expect(screen.getByText('אתם')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /משך הסימולציה/ })).toHaveValue('10');
    expect(screen.getByRole('button', { name: /בדיקה ועריכה/ })).toBeEnabled();
  });

  it('requires regeneration after changing settings and confirms before discarding report edits', async () => {
    renderBuilder();
    await makeReports();
    fireEvent.click(screen.getByRole('button', { name: /תרחיש בשיחה/ }));
    fireEvent.change(screen.getByRole('slider', { name: /קצב הזרמת דיווחים/ }), { target: { value: '1' } });
    expect(screen.getByRole('button', { name: /בדיקה ועריכה/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'יצירת הסימולציה מחדש' }));
    expect(screen.getByRole('button', { name: 'החלפת הדיווחים' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ביטול יצירה מחדש' }));
    expect(screen.queryByRole('button', { name: 'החלפת הדיווחים' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'שמירה כטיוטה' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'יצירת הסימולציה מחדש' }));
    fireEvent.click(screen.getByRole('button', { name: 'החלפת הדיווחים' }));
    await screen.findByRole('heading', { name: /דיווחים בסימולציה 10/ });
  });

  it('surfaces failed chat and keeps the input for retry', async () => {
    vi.spyOn(aiSimulationService, 'replyToScenario').mockRejectedValueOnce(new Error('Demo unavailable'));
    renderBuilder();
    fireEvent.change(screen.getByLabelText('הודעה לעוזר הסימולציה'), { target: { value: 'תרחיש לבדיקה' } });
    fireEvent.click(screen.getByRole('button', { name: 'שליחה' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Demo unavailable');
    expect(screen.getByLabelText('הודעה לעוזר הסימולציה')).toHaveValue('תרחיש לבדיקה');
    expect(screen.getByRole('button', { name: 'שליחה' })).toBeEnabled();
  });

  it('paginates the generated set and filters by report kind', async () => {
    renderBuilder();
    fireEvent.click(screen.getByText('דוגמאות לתרחישים · בחירה תחיל את הגדרות הדוגמה'));
    fireEvent.click(screen.getByRole('button', { name: 'חילוץ באזור תעשייה · רמה בינונית' }));
    fireEvent.change(screen.getByLabelText('הודעה לעוזר הסימולציה'), { target: { value: 'תרגיל חילוץ בחיפה' } });
    fireEvent.click(screen.getByRole('button', { name: 'שליחה' }));
    await screen.findByText('אתם');
    fireEvent.click(screen.getByRole('button', { name: 'יצירת הסימולציה' }));
    await screen.findByRole('heading', { name: /דיווחים בסימולציה 60/ });
    expect(screen.getAllByRole('button', { name: /^עריכת דיווח:/ })).toHaveLength(12);
    expect(screen.getByText('עמוד 1 מתוך 5')).toBeInTheDocument();
    const boundaryCard = screen.getAllByRole('article')[11];
    const boundaryTitle = within(boundaryCard).getByRole('heading').textContent;
    fireEvent.click(within(boundaryCard).getByRole('button', { name: /^העברה למטה:/ }));
    expect(screen.getByText('עמוד 2 מתוך 5')).toBeInTheDocument();
    expect(within(screen.getAllByRole('article')[0]).getByRole('heading')).toHaveTextContent(boundaryTitle ?? '');
    fireEvent.click(within(screen.getAllByRole('article')[0]).getByRole('button', { name: /^העברה למעלה:/ }));
    expect(screen.getByText('עמוד 1 מתוך 5')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ללא סיווג (60)' }));
    expect(screen.getByText('עמוד 1 מתוך 5')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'לעמוד הבא' }));
    fireEvent.click(screen.getByRole('button', { name: 'לעמוד הבא' }));
    fireEvent.click(screen.getByRole('button', { name: 'לעמוד הבא' }));
    fireEvent.click(screen.getByRole('button', { name: 'לעמוד הבא' }));
    expect(screen.getAllByRole('button', { name: /^עריכת דיווח:/ })).toHaveLength(12);
    expect(screen.getByRole('button', { name: 'לעמוד הבא' })).toBeDisabled();
  });

  it('keeps the existing reports on a generation error and allows retry', async () => {
    renderBuilder();
    await makeReports();
    vi.spyOn(aiSimulationService, 'generateReports').mockRejectedValueOnce(new Error('Generation unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'תיאור חדש ויצירה מחדש' }));
    fireEvent.click(screen.getByRole('button', { name: 'יצירת הסימולציה מחדש' }));
    fireEvent.click(screen.getByRole('button', { name: 'החלפת הדיווחים' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Generation unavailable');
    fireEvent.click(screen.getByRole('button', { name: /בדיקה ועריכה/ }));
    expect(screen.getByRole('heading', { name: /דיווחים בסימולציה 5/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'תיאור חדש ויצירה מחדש' }));
    fireEvent.click(screen.getByRole('button', { name: 'יצירת הסימולציה מחדש' }));
    fireEvent.click(screen.getByRole('button', { name: 'החלפת הדיווחים' }));
    await screen.findByRole('heading', { name: /דיווחים בסימולציה 5/ });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('requires a report to continue after removing the entire set', async () => {
    renderBuilder();
    await makeReports();
    for (const button of screen.getAllByRole('button', { name: /^הסרת דיווח:/ })) fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'המשך לשמירה' })).toBeDisabled();
    expect(screen.getByText('אין דיווחים להצגה. אפשר להוסיף מהספרייה או ליצור מחדש.')).toBeInTheDocument();
  });

  it('does not claim success when local storage fails', async () => {
    renderBuilder();
    await makeReports();
    fireEvent.click(screen.getByRole('button', { name: 'המשך לשמירה' }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    fireEvent.click(screen.getAllByRole('button', { name: 'שמירה כטיוטה' })[0]);
    expect(screen.getByRole('alert')).toHaveTextContent('השמירה המקומית נכשלה');
    expect(screen.queryByText('טיוטה מקומית')).not.toBeInTheDocument();
    expect(localStorage.getItem(AI_SIMULATIONS_KEY)).toBeNull();
  });

  it('explains missing drafts rather than displaying a new draft as a successful load', () => {
    renderBuilder('/simulations/ai?id=missing');
    expect(screen.getByRole('alert')).toHaveTextContent('לא נמצאה');
    expect(screen.getByRole('link', { name: 'פתיחת בונה AI חדש' })).toBeInTheDocument();
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
  });
});
