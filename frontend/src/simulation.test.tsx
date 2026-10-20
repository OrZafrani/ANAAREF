import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Layout from './layout/Layout';
import Home from './pages/Home';
import CreateSimulation from './pages/CreateSimulation';
import SelectEvents from './pages/SelectEvents';

describe('Simulation Flow - Mockup Alignment', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
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
    expect(screen.getByText('עדיין אין סימולציות ב-SPECTRE')).toBeInTheDocument();

    // Verify button exists
    const newSimBtn = screen.getByRole('button', { name: /סימולציה חדשה/i });
    expect(newSimBtn).toBeInTheDocument();
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

  it('renders events selection step 2 and tracks amount of selected events', () => {
    const testState = {
      title: 'מטח פתיחה — עוטף עזה',
      description: 'תרגול תרחיש תגובה מהירה',
      difficulty: 'קשה' as const,
    };

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

    // Open library modal and add an event from catalog
    fireEvent.click(screen.getByRole('button', { name: /הוספה מהספרייה/i }));
    expect(screen.getByText('ספריית התוכן')).toBeInTheDocument();

    const addButtons = screen.getAllByRole('button', { name: /הוסף לסימולציה/i });
    expect(addButtons.length).toBeGreaterThan(0);
    fireEvent.click(addButtons[0]);

    // Check count and selection state
    expect(screen.getAllByText('נבחר לסימולציה').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /סיום והמשך/i }));
    expect(screen.getByText('דיווחים שנבחרו לסימולציה')).toBeInTheDocument();
  });
  it('lists saved simulations for the selected system and filters by difficulty', () => {
    const base = { description: '', events: [], createdAt: '2026-10-19T10:00:00.000Z' };
    localStorage.setItem('cobra_simulations', JSON.stringify([
      { ...base, id: 's1', title: 'מטח פתיחה', difficulty: 'קשה' },
      { ...base, id: 's2', title: 'תרגול בסיסי', difficulty: 'קל', sys: 'spectre' },
      { ...base, id: 's3', title: 'אירוע ניהול לחימה', difficulty: 'בינוני', sys: 'cm' },
    ]));

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    // SPECTRE is the default system; older saves without sys count as SPECTRE
    expect(screen.getByText('מטח פתיחה')).toBeInTheDocument();
    expect(screen.getByText('תרגול בסיסי')).toBeInTheDocument();
    expect(screen.queryByText('אירוע ניהול לחימה')).not.toBeInTheDocument();
    expect(screen.getByText('מוצגות 2 מתוך 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'קל' }));
    expect(screen.queryByText('מטח פתיחה')).not.toBeInTheDocument();
    expect(screen.getByText('מוצגות 1 מתוך 2')).toBeInTheDocument();
  });

  it('opens the simulation summary drawer from a card', () => {
    localStorage.setItem('cobra_simulations', JSON.stringify([{
      id: 's1',
      title: 'מטח פתיחה',
      description: 'תרגול תגובה מהירה',
      difficulty: 'בינוני',
      events: [{ id: 'e1', title: 'זיהוי רחפן', category: 'מבצעי', minute: 8, description: 'כלי טיס זעיר' }],
      createdAt: '2026-10-19T10:00:00.000Z',
    }]));

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'מטח פתיחה' }));
    const drawer = screen.getByRole('dialog', { name: 'מטח פתיחה' });
    expect(drawer).toHaveTextContent('אירועים לפי סדר הזרמה · 1');
    expect(drawer).toHaveTextContent('T+8');
    expect(drawer).toHaveTextContent('30 דק׳');
  });
});
