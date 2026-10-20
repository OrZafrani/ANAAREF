import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Layout from './layout/Layout';
import Home from './pages/Home';
import CreateSimulation from './pages/CreateSimulation';
import SelectEvents from './pages/SelectEvents';
import { getUrgency } from './lib/urgency';

describe('Simulation Flow - Mockup Alignment', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
  });

  describe('Urgency thresholds', () => {
    it.each([
      [25, 'low', 'נמוך'],
      [26, 'medium', 'בינוני'],
      [50, 'medium', 'בינוני'],
      [51, 'high', 'גבוה'],
      [75, 'high', 'גבוה'],
      [76, 'critical', 'קריטי'],
    ] as const)('maps %i to %s urgency', (score, level, label) => {
      expect(getUrgency(score)).toEqual({ level, label });
    });

    it('reports missing scores as unknown', () => {
      expect(getUrgency(null)).toEqual({ level: 'unknown', label: 'לא ידוע' });
    });
  });

  it('renders global navbar and sidebar matching upper mockup', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Layout>
          <Home />
        </Layout>
      </MemoryRouter>
    );

    // Global Navbar elements
    const navbar = within(screen.getByRole('banner'));
    expect(navbar.getByText('COBRA')).toBeInTheDocument();
    expect(navbar.getByText('בנייה, ניהול והרצה סימולציות')).toBeInTheDocument();
    expect(navbar.getByText('מערכת יעד')).toBeInTheDocument();
    expect(navbar.getByText('SPECTRE')).toBeInTheDocument();
    expect(navbar.getByText('ניהול לחימה')).toBeInTheDocument();
    expect(navbar.getByText('מצב כהה')).toBeInTheDocument();
    expect(navbar.getByText('מה')).toBeInTheDocument();

    // Sidebar navigation
    expect(screen.getByRole('link', { name: /לוח בקרה/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ספריית תוכן/ })).toBeInTheDocument();
  });

  it('renders default home view and contains the new simulation trigger button', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    // Dashboard heading and empty state
    expect(screen.getByRole('heading', { name: 'לוח בקרה' })).toBeInTheDocument();

    // Verify button exists
    const newSimBtn = screen.getByRole('button', { name: /סימולציה חדשה/i });
    expect(newSimBtn).toBeInTheDocument();
  });

  it('loads saved simulations and deletes through the API', async () => {
    const savedSimulation = {
      id: 'saved-simulation-id',
      title: 'תרגיל מהשרת',
      description: 'סימולציה שנשמרה במסד',
      difficulty: 'בינוני' as const,
      events: [],
      createdAt: '2026-10-19T10:00:00.000Z',
    };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/simulations' && !init?.method) {
        return Promise.resolve(new Response(JSON.stringify([savedSimulation]), { status: 200 }));
      }
      if (url === '/api/categories/tree') {
        return Promise.resolve(new Response('[]', { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    global.fetch = fetchMock;
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    expect(await screen.findByText('תרגיל מהשרת')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /מחיקת הסימולציה תרגיל מהשרת/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/simulations/saved-simulation-id',
      { method: 'DELETE' },
    ));
    expect(screen.queryByText('תרגיל מהשרת')).not.toBeInTheDocument();
  });

  it('opens modal with Manual and AI options when clicking new simulation button', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    const newSimBtn = screen.getByRole('button', { name: /סימולציה חדשה/i });
    fireEvent.click(newSimBtn);

    // Modal should be open
    expect(screen.getByText('יצירת סימולציה חדשה')).toBeInTheDocument();
    expect(screen.getByText('יצירה ידנית')).toBeInTheDocument();
    expect(screen.getByText('יצירה אוטומטית (AI)')).toBeInTheDocument();
    expect(screen.getByText('בקרוב')).toBeInTheDocument();
  });

  it('renders create simulation page matching mockup elements', () => {
    render(
      <MemoryRouter initialEntries={['/simulations/new']}>
        <Layout>
          <Routes>
            <Route path="/simulations/new" element={<CreateSimulation />} />
          </Routes>
        </Layout>
      </MemoryRouter>
    );

    // Pre-bar button
    expect(screen.getAllByRole('button', { name: /סימולציה חדשה/i }).length).toBeGreaterThan(0);

    // Builder header
    expect(screen.getByRole('button', { name: /לוח הבקרה/i })).toBeInTheDocument();
    expect(screen.getByText('בונה ידני · סימולציה חדשה')).toBeInTheDocument();
    expect(screen.getByText('סימולציה ללא שם')).toBeInTheDocument();

    // Stepper pills
    expect(screen.getByText('פרטים והגדרות')).toBeInTheDocument();
    expect(screen.getByText('תוכן')).toBeInTheDocument();
    expect(screen.getByText('סקירה ושמירה')).toBeInTheDocument();

    // Card 1
    expect(screen.getByText('פרטי הסימולציה')).toBeInTheDocument();
    expect(screen.getByLabelText(/שם הסימולציה/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/תיאור והקשר התרחיש/i)).toBeInTheDocument();

    // Card 2
    expect(screen.getByText('רמת קושי והגדרות הזרמה')).toBeInTheDocument();
    expect(screen.getByText('קל')).toBeInTheDocument();
    expect(screen.getByText('בינוני')).toBeInTheDocument();
    expect(screen.getByText('קשה')).toBeInTheDocument();

    // Bottom action bar
    expect(screen.getByRole('button', { name: /הבא/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /הקודם/i })).toBeInTheDocument();
  });

  it('validates simulation name on create simulation page', () => {
    render(
      <MemoryRouter initialEntries={['/simulations/new']}>
        <Routes>
          <Route path="/simulations/new" element={<CreateSimulation />} />
        </Routes>
      </MemoryRouter>
    );

    const nextBtn = screen.getByRole('button', { name: /הבא/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText('נא להזין שם לסימולציה')).toBeInTheDocument();
  });

  it('uses library categories and reports in events selection step 2', async () => {
    const categories = [{
      id: 'category-1',
      name: 'תפעול',
      report_count: 2,
      sub_categories: [{ id: 'subcategory-1', category_id: 'category-1', name: 'התראות', report_count: 1 }],
    }];
    const reports = [
      {
        id: 'report-1',
        category_id: 'category-1',
        sub_category_id: 'subcategory-1',
        category_name: 'תפעול',
        sub_category_name: 'התראות',
        matches: ['חשד', 'גבול'],
        report_title: 'דיווח מספריית התוכן',
        original_content: 'תוכן הדיווח שנשמר בספרייה',
        translated_content: null,
        report_url: 'https://example.com/report-1',
        threat_level: 80,
        city: 'באר שבע',
        country: 'IL',
        happened_at: null,
        collected_at: '2025-01-01T12:00:00.000Z',
      },
      {
        id: 'report-2',
        category_id: 'category-1',
        sub_category_id: null,
        category_name: 'תפעול',
        sub_category_name: null,
        report_title: 'דיווח כללי',
        original_content: 'תוכן נוסף',
        translated_content: null,
        report_url: 'https://example.com/report-2',
        city: null,
        country: null,
        happened_at: null,
        collected_at: '2025-01-02T12:00:00.000Z',
      },
    ];
    const testState = {
      title: 'מטח פתיחה — עוטף עזה',
      description: 'תרגול תרחיש תגובה מהירה',
      difficulty: 'קשה' as const,
    };
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/categories/tree')) {
        return new Response(JSON.stringify(categories), { status: 200 });
      }
      if (url.includes('/api/templates')) {
        return new Response(JSON.stringify(reports), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });

    render(
      <MemoryRouter initialEntries={[{ pathname: '/simulations/events', state: testState }]}>
        <Routes>
          <Route path="/simulations/events" element={<SelectEvents />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getAllByText('מטח פתיחה — עוטף עזה').length).toBeGreaterThan(0);
    // Stepper shows the difficulty context in new mockup layout (step pills only)
    expect(screen.getByText('תוכן')).toBeInTheDocument();

    // New single-card layout: empty state + add-from-library button
    expect(screen.getByText('דיווחים שנבחרו לסימולציה')).toBeInTheDocument();
    expect(screen.getByText('עדיין לא נוסף תוכן')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /הוספה מהספרייה/i })).toBeInTheDocument();

    // Wait for DB templates to load, then open library modal and add an event
    expect(await screen.findByText(/דיווחים זמינים מספריית התוכן/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /הוספה מהספרייה/i }));
    expect(screen.getByText('ספריית התוכן')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('דיווח מספריית התוכן')).toBeInTheDocument());
    expect(screen.getAllByText('תפעול').length).toBeGreaterThan(0);
    expect(screen.getByText('התראות')).toBeInTheDocument();
    expect(screen.getAllByText('מקורי')).toHaveLength(2);
    expect(screen.queryByText(/חשד, גבול/)).not.toBeInTheDocument();
    expect(screen.queryByText('מקור רשמי')).not.toBeInTheDocument();
    expect(screen.queryByText('מקור פתוח')).not.toBeInTheDocument();
    expect(screen.getByText('באר שבע · IL')).toBeInTheDocument();
    expect(screen.getByText('דחיפות: קריטי')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /הוסף לסימולציה: דיווח מספריית התוכן/ })).not.toBeInTheDocument();
    expect(screen.getByText('דיווח כללי')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /התראות/ }));
    expect(screen.queryByText('דיווח כללי')).not.toBeInTheDocument();
    expect(screen.getByText(/דקה בסימולציה: 23/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('תוכן הדיווח שנשמר בספרייה'));

    // Check count and selection state
    expect(screen.getByText('קטגוריה: תפעול · התראות')).toBeInTheDocument();
    expect(screen.getByText('דקה 23')).toBeInTheDocument();
    const reportCheckbox = screen.getByRole('checkbox', { name: /הסר מהסימולציה: דיווח מספריית התוכן/ });
    expect(reportCheckbox).toBeChecked();
    fireEvent.click(reportCheckbox);
    expect(screen.getByRole('checkbox', { name: /הוסף לסימולציה: דיווח מספריית התוכן/ })).not.toBeChecked();
    fireEvent.click(screen.getByText('תוכן הדיווח שנשמר בספרייה'));
    expect(screen.getByRole('checkbox', { name: /הסר מהסימולציה: דיווח מספריית התוכן/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /סיום והמשך/i }));
    expect(screen.getByText('דיווחים שנבחרו לסימולציה')).toBeInTheDocument();
  });
  it('saves a simulation and selected events through the API', async () => {
    const createdAt = '2026-10-19T10:00:00.000Z';
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/categories/tree')) {
        return new Response('[]', { status: 200 });
      }
      if (url.includes('/api/templates')) {
        return new Response(JSON.stringify([{
            id: 'tpl-1',
            category_id: 'cat-1',
            sub_category_id: null,
            category_name: 'מבצעי',
            sub_category_name: null,
            report_title: 'זיהוי תנועה חשודה בגדר המערכת',
            original_content: 'חיישני הגדר המערבית זיהו תנועה חריגה.',
            matches: ['התראה'],
            collected_at: '2026-10-19T10:00:00.000Z',
          }]), { status: 200 });
      }
      return new Response(JSON.stringify({ id: 'database-simulation-id', createdAt }), { status: 201 });
    });
    global.fetch = fetchMock;
    const testState = {
      title: 'תרגיל שמור',
      description: 'תיאור תרגיל',
      difficulty: 'בינוני' as const,
    };

    render(
      <MemoryRouter initialEntries={[{ pathname: '/simulations/events', state: testState }] }>
        <Routes>
          <Route path="/simulations/events" element={<SelectEvents />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for DB library to load, then pick the template event
    expect(await screen.findByText(/דיווחים זמינים מספריית התוכן/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /הוספה מהספרייה/i }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /הוסף לסימולציה:/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /סקירה ושמירה/i })[1]);
    fireEvent.click(screen.getByRole('button', { name: /שמירה ואישור/i }));

    expect(await screen.findByText('הסימולציה נשמרה בהצלחה')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/simulations', expect.objectContaining({
      method: 'POST',
    }));
    const postCall = vi.mocked(global.fetch).mock.calls.find((call) => String(call[0]).includes('/api/simulations'));
    expect(postCall?.[1]?.body).toBeDefined();
    const requestBody = JSON.parse(String(postCall?.[1]?.body));
    expect(requestBody.events).toHaveLength(1);
    expect(requestBody.events[0].title).toBe('זיהוי תנועה חשודה בגדר המערכת');
    expect(localStorage.getItem('cobra_simulations')).toBeNull();
  });

  it('lists saved simulations for the selected system and filters by difficulty', async () => {
    const base = { description: '', events: [], createdAt: '2026-10-19T10:00:00.000Z' };
    const savedSimulations = [
      { ...base, id: 's1', title: 'מטח פתיחה', difficulty: 'קשה' },
      { ...base, id: 's2', title: 'תרגול בסיסי', difficulty: 'קל', sys: 'spectre' },
      { ...base, id: 's3', title: 'אירוע ניהול לחימה', difficulty: 'בינוני', sys: 'cm' },
    ];
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => Promise.resolve(
      new Response(JSON.stringify(String(input).includes('/api/simulations') ? savedSimulations : []), { status: 200 }),
    )));

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    // SPECTRE is the default system; older saves without sys count as SPECTRE
    expect(await screen.findByText('מטח פתיחה')).toBeInTheDocument();
    expect(screen.getByText('תרגול בסיסי')).toBeInTheDocument();
    expect(screen.queryByText('אירוע ניהול לחימה')).not.toBeInTheDocument();
    expect(await screen.findByText('מוצגות 2 מתוך 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'קל' }));
    await waitFor(() => expect(screen.queryByText('מטח פתיחה')).not.toBeInTheDocument());
    expect(screen.getByText('מוצגות 1 מתוך 2')).toBeInTheDocument();
  });

  it('opens the simulation summary drawer from a card', async () => {
    const savedSimulation = {
      id: 's1',
      title: 'מטח פתיחה',
      description: 'תרגול תגובה מהירה',
      difficulty: 'בינוני',
      events: [{ id: 'e1', title: 'זיהוי רחפן', category: 'מבצעי', minute: 8, description: 'כלי טיס זעיר' }],
      createdAt: '2026-10-19T10:00:00.000Z',
    };
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => Promise.resolve(
      new Response(JSON.stringify(String(input).includes('/api/simulations') ? [savedSimulation] : []), { status: 200 }),
    )));

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'מטח פתיחה' }));
    const drawer = screen.getByRole('dialog', { name: 'מטח פתיחה' });
    expect(drawer).toHaveTextContent('אירועים לפי סדר הזרמה · 1');
    expect(drawer).toHaveTextContent('T+8');
    expect(drawer).toHaveTextContent('30 דק׳');
  });
});
