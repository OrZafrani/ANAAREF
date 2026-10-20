import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './pages/Home';
import { RunRequestError, type SimulationRun } from './lib/runsApi';
import { runBlockReason, runErrorMessage } from './lib/runFormat';
import type { Simulation } from './types/simulation';

const event = { id: 'e1', title: 'זיהוי רחפן', category: 'מבצעי', minute: 1, description: 'כלי טיס זעיר' };

const simulation = (overrides: Partial<Simulation> = {}): Simulation => ({
  id: 's1',
  title: 'מטח פתיחה',
  description: '',
  difficulty: 'בינוני',
  sys: 'spectre',
  events: [event],
  createdAt: '2026-10-19T10:00:00.000Z',
  ...overrides,
});

const run = (overrides: Partial<SimulationRun> = {}): SimulationRun => ({
  id: 'r1',
  simulation_id: 's1',
  simulation_name: 'מטח פתיחה',
  target_system: 'specter',
  simulation_length_s: 1800,
  started_at: new Date().toISOString(),
  completed_at: null,
  status: 'started',
  dispatched_count: 2,
  report_count: 5,
  failure_reason: null,
  ...overrides,
});

/** Serves the dashboard's requests; `state` can change between calls. */
function mockBackend(state: { simulations: Simulation[]; runs: SimulationRun[]; startStatus?: number; startError?: string }) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
    if (url === '/api/simulations/runs/active') return json(state.runs.find((r) => r.status === 'started') ?? null);
    if (url === '/api/simulations/runs') return json(state.runs);
    if (method === 'POST' && /\/runs\/[^/]+\/stop$/.test(url)) {
      state.runs = state.runs.map((r) => ({ ...r, status: 'stopped' as const, completed_at: new Date().toISOString() }));
      return json({ id: 'r1', status: 'stopped' });
    }
    if (method === 'POST' && url.endsWith('/runs')) {
      if (state.startStatus) return json({ error: state.startError ?? 'refused' }, state.startStatus);
      state.runs = [run({ dispatched_count: 0 })];
      return json({ id: 'r1', status: 'started' }, 201);
    }
    if (url === '/api/simulations') return json(state.simulations);
    return json([]);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const renderHome = () => render(<MemoryRouter><Home /></MemoryRouter>);
const runButton = () => screen.findByRole('button', { name: 'הרצת הסימולציה מטח פתיחה' });

describe('running a simulation from the dashboard', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('starts a run from a card and shows its progress', async () => {
    const fetchMock = mockBackend({ simulations: [simulation()], runs: [] });
    renderHome();

    fireEvent.click(await runButton());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/simulations/s1/runs', { method: 'POST' }));
    const progress = await screen.findByRole('progressbar', { name: 'התקדמות הריצה' });
    expect(progress).toHaveAttribute('aria-valuemax', '5');
    expect(screen.getByText(/נשלחו/).closest('.run-progress-label')).toHaveTextContent('נשלחו 0 מתוך 5 דיווחים');
    expect(screen.getByText('רצה כעת')).toBeInTheDocument();
  });

  it('stops the active run after confirmation', async () => {
    const fetchMock = mockBackend({ simulations: [simulation()], runs: [run()] });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderHome();

    fireEvent.click(await screen.findByRole('button', { name: 'עצירת הריצה' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/simulations/s1/runs/r1/stop', { method: 'POST' }));
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
  });

  it('explains instead of starting while another simulation runs', async () => {
    const fetchMock = mockBackend({
      simulations: [simulation(), simulation({ id: 's2', title: 'תרגול בסיסי' })],
      runs: [run({ simulation_id: 's2', simulation_name: 'תרגול בסיסי' })],
    });
    renderHome();
    await screen.findByRole('progressbar');

    fireEvent.click(await runButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('סימולציה אחרת רצה כעת');
    expect(fetchMock).not.toHaveBeenCalledWith('/api/simulations/s1/runs', { method: 'POST' });
  });

  it('shows the backend refusal in Hebrew', async () => {
    mockBackend({ simulations: [simulation()], runs: [], startStatus: 409, startError: 'Another simulation already has a started run' });
    renderHome();

    fireEvent.click(await runButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('סימולציה אחרת כבר רצה');
  });

  it('shows how far a finished run got, without an in-progress estimate', async () => {
    mockBackend({
      simulations: [simulation()],
      runs: [run({ status: 'completed', completed_at: new Date().toISOString(), dispatched_count: 5 })],
    });
    renderHome();

    const runsCard = (await screen.findByText('נשלחו 5 מתוך 5')).closest('.runs') as HTMLElement;
    expect(within(runsCard).getByText('הושלמה')).toBeInTheDocument();
    expect(within(runsCard).queryByText('הריצה בעיצומה')).not.toBeInTheDocument();
  });

  it('lists the run history and offers stop in the drawer', async () => {
    mockBackend({ simulations: [simulation()], runs: [run()] });
    renderHome();

    fireEvent.click(await screen.findByRole('button', { name: 'מטח פתיחה' }));
    const drawer = screen.getByRole('dialog', { name: 'מטח פתיחה' });

    await waitFor(() => expect(drawer).toHaveTextContent('היסטוריית ריצות · 1'));
    expect(drawer).toHaveTextContent('נשלחו 2 מתוך 5 דיווחים');
    expect(within(drawer).getByRole('button', { name: 'עצירת הריצה' })).toBeInTheDocument();
  });
});

describe('runBlockReason', () => {
  it('blocks COMBAT simulations, empty simulations and a second active run', () => {
    expect(runBlockReason(simulation({ sys: 'cm' }), null)).toMatch(/ניהול לחימה/);
    expect(runBlockReason(simulation({ events: [] }), null)).toMatch(/אין בסימולציה אירועים/);
    expect(runBlockReason(simulation(), run())).toBe('הסימולציה רצה כעת');
    expect(runBlockReason(simulation(), run({ simulation_id: 's2' }))).toMatch(/סימולציה אחרת רצה כעת/);
    expect(runBlockReason(simulation(), null)).toBeNull();
  });
});

describe('runErrorMessage', () => {
  it('maps backend refusals to Hebrew', () => {
    expect(runErrorMessage(new RunRequestError('Simulation has no reports to dispatch', 422), 'start'))
      .toBe('אין בסימולציה אירועים להזרמה.');
    expect(runErrorMessage(new RunRequestError('Run is not running (status: completed)', 409), 'stop'))
      .toBe('הריצה כבר הסתיימה.');
    expect(runErrorMessage(new Error('network down'), 'start')).toBe('הפעלת הריצה נכשלה. נסו שוב.');
  });
});
