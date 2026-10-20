import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Layout from './layout/Layout';
import Home from './pages/Home';
import CreateSimulation from './pages/CreateSimulation';
import SelectEvents from './pages/SelectEvents';

describe('Simulation Flow - Mockup Alignment', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
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
    expect(screen.getByText('COBRA')).toBeInTheDocument();
    expect(screen.getByText('בנייה, ניהול והרצה סימולציות')).toBeInTheDocument();
    expect(screen.getByText('מערכת יעד')).toBeInTheDocument();
    expect(screen.getAllByText('SPECTRE').length).toBeGreaterThan(0);
    expect(screen.getByText('ניהול לחימה')).toBeInTheDocument();
    expect(screen.getByText('מצב כהה')).toBeInTheDocument();
    expect(screen.getByText('מה')).toBeInTheDocument();

    // Sidebar navigation
    expect(screen.getByText('לוח בקרה')).toBeInTheDocument();
    expect(screen.getByText('ספריית תוכן')).toBeInTheDocument();
  });

  it('renders default home view and contains the new simulation trigger button', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'ניהול סימולציות' })).toBeInTheDocument();

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
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [savedSimulation] })
      .mockResolvedValueOnce({ ok: true, status: 204 });
    global.fetch = fetchMock;

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    expect(await screen.findByText('תרגיל מהשרת')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /מחק סימולציה/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenNthCalledWith(
      2,
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
        report_title: 'דיווח מספריית התוכן',
        original_content: 'תוכן הדיווח שנשמר בספרייה',
        translated_content: null,
        report_url: 'https://example.com/report-1',
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
    expect(screen.getByText('דיווח כללי')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /התראות/ }));
    expect(screen.queryByText('דיווח כללי')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: /דקה בסימולציה: דיווח מספריית התוכן/ }), {
      target: { value: '7' },
    });
    fireEvent.click(screen.getByRole('button', { name: /הוסף לסימולציה: דיווח מספריית התוכן/ }));

    // Check count and selection state
    expect(screen.getByText('קטגוריה: תפעול · התראות')).toBeInTheDocument();
    expect(screen.getByText('דקה 7')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /הסר מהסימולציה: דיווח מספריית התוכן/ })).toBeInTheDocument();
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
    fireEvent.click((await screen.findAllByRole('button', { name: /הוסף לסימולציה/i }))[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /סקירה ושמירה/i })[1]);
    fireEvent.click(screen.getByRole('button', { name: /שמירה ואישור/i }));

    expect(await screen.findByText('הסימולציה נשמרה בהצלחה')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/simulations', expect.objectContaining({
      method: 'POST',
    }));
    const postCall = vi.mocked(global.fetch).mock.calls.find((call) => String(call[0]).includes('/api/simulations'));
    const requestBody = JSON.parse(
      (postCall?.[1] as any)?.body as string,
    );
    expect(requestBody.events).toHaveLength(1);
    expect(requestBody.events[0].title).toBe('זיהוי תנועה חשודה בגדר המערכת');
    expect(localStorage.getItem('cobra_simulations')).toBeNull();
  });
});
