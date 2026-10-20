import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AiSimulation from './AiSimulation';
import Home from './Home';
import { aiSimulationService } from '../lib/aiSimulation';
import { AI_SIMULATIONS_KEY, loadAiSimulations } from '../lib/aiSimulationStorage';
import { MOCK_LIBRARY_TEMPLATES } from '../data/aiSimulationFixtures';

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

async function makeReports() {
  fireEvent.change(screen.getByLabelText('הודעה לעוזר הסימולציה'), { target: { value: 'תרגיל חילוץ בחיפה' } });
  fireEvent.click(screen.getByRole('button', { name: 'שליחה' }));
  await screen.findByText('אתם');
  fireEvent.change(screen.getByRole('slider', { name: /קצב הזרמת דיווחים/ }), { target: { value: '0.5' } });
  fireEvent.change(screen.getByRole('slider', { name: /משך הסימולציה/ }), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'יצירת הסימולציה' }));
  await screen.findByRole('heading', { name: /דיווחים בסימולציה 5/ });
}

describe('AI simulation frontend flow', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('AI builder must not use a backend')));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

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

  it('generates, edits, copies a complete library template, removes a report, saves, and resumes from the dashboard', async () => {
    renderBuilder();
    fireEvent.change(screen.getByLabelText(/שם הסימולציה/), { target: { value: 'תרגיל AI מקומי' } });
    await makeReports();
    fireEvent.click(screen.getAllByRole('button', { name: /^עריכת דיווח:/ })[0]);
    const editor = screen.getByRole('dialog', { name: 'עריכת דיווח בסימולציה' });
    fireEvent.change(within(editor).getByLabelText('כותרת'), { target: { value: 'דיווח שנערך' } });
    fireEvent.change(within(editor).getByLabelText('פצועים — כוחותינו'), { target: { value: '0' } });
    fireEvent.change(within(editor).getByLabelText('עיתוי בסימולציה (דקה)'), { target: { value: '1.5' } });
    fireEvent.click(within(editor).getByRole('button', { name: 'שמירת שינויים' }));
    expect(screen.getByText('דיווח שנערך')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'הוספה מהספרייה' }));
    await screen.findByRole('button', { name: 'הוסף לסימולציה: צוותי חילוץ הגיעו לאזור התרגיל' });
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
    await waitFor(() => expect(loadAiSimulations()).toHaveLength(1));
    const saved = loadAiSimulations()[0];
    expect(saved).toMatchObject({ status: 'saved', step: 3, simulation: { name: 'תרגיל AI מקומי', ai_generated: true, target_system: 'specter', reality_id: 1 } });
    expect(saved.reports).toHaveLength(5);
    expect(saved.reports.find((report) => report.payload.report_title === 'דיווח שנערך')).toMatchObject({
      dispatch_offset_s: 90, payload: { blue_injured_count: 0, red_injured_count: null },
    });
    expect(saved.reports.find((report) => report.template_id === MOCK_LIBRARY_TEMPLATES[0].id)).toMatchObject({
      dispatch_offset_s: 120, payload: { platform: 'telegram', city: 'חיפה', lat: 32.794, blue_death_count: 0, blue_injured_count: null },
    });
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'לוח הבקרה' }));
    expect(screen.getByRole('heading', { name: /סימולציות AI מקומיות/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'המשך עריכה' }));
    expect(screen.getByRole('heading', { name: 'סקירה ושמירה' })).toBeInTheDocument();
    expect(screen.getByText('דיווח שנערך')).toBeInTheDocument();
  });

  it('shows save options only at the final step and restores a saved draft', async () => {
    const view = renderBuilder();
    expect(screen.queryByRole('button', { name: 'שמירה כטיוטה' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'שמירה', exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'סגירה', exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('טרם נשמר')).not.toBeInTheDocument();
    await makeReports();
    expect(screen.queryByRole('button', { name: 'שמירה כטיוטה' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'המשך לשמירה' }));
    expect(screen.getAllByRole('button', { name: 'שמירה כטיוטה' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'שמירת הסימולציה' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'שמירה כטיוטה' }));
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
    expect(screen.queryByRole('button', { name: 'שמירה כטיוטה' })).not.toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText('הודעה לעוזר הסימולציה'), { target: { value: 'תרגיל חילוץ בחיפה' } });
    fireEvent.click(screen.getByRole('button', { name: 'שליחה' }));
    await screen.findByText('אתם');
    fireEvent.click(screen.getByRole('button', { name: 'יצירת הסימולציה' }));
    await screen.findByRole('heading', { name: /דיווחים בסימולציה 120/ });
    expect(screen.getAllByRole('button', { name: /^עריכת דיווח:/ })).toHaveLength(12);
    expect(screen.getByText('עמוד 1 מתוך 10')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'לעמוד הבא' }));
    expect(screen.getByText('עמוד 2 מתוך 10')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'רעש רקע (30)' }));
    expect(screen.getByText('עמוד 1 מתוך 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'לעמוד הבא' }));
    fireEvent.click(screen.getByRole('button', { name: 'לעמוד הבא' }));
    expect(screen.getAllByRole('button', { name: /^עריכת דיווח:/ })).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'לעמוד הבא' })).toBeDisabled();
  });

  it('keeps the existing reports on a generation error and allows retry', async () => {
    renderBuilder();
    await makeReports();
    vi.spyOn(aiSimulationService, 'generateReports').mockRejectedValueOnce(new Error('Generation unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'יצירה מחדש' }));
    fireEvent.click(screen.getByRole('button', { name: 'החלפת הדיווחים' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Generation unavailable');
    expect(screen.getByRole('heading', { name: /דיווחים בסימולציה 5/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'יצירה מחדש' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'שמירה כטיוטה' }));
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
