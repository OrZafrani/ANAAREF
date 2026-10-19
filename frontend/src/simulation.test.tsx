import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import CreateSimulation from './pages/CreateSimulation';
import SelectEvents from './pages/SelectEvents';
import NewSimulationModal from './components/NewSimulationModal';

describe('Simulation Flow', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders default home view and contains the new simulation trigger button', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    // Verify default view is untouched
    expect(screen.getByText('or the king')).toBeInTheDocument();

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

  it('renders create simulation page with title, description, and difficulty level', () => {
    render(
      <MemoryRouter initialEntries={['/simulations/new']}>
        <Routes>
          <Route path="/simulations/new" element={<CreateSimulation />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/כותרת הסימולציה/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/תיאור הסימולציה/i)).toBeInTheDocument();
    expect(screen.getByText('רמת קושי')).toBeInTheDocument();

    // Check difficulty options
    expect(screen.getByText('קל')).toBeInTheDocument();
    expect(screen.getByText('בינוני')).toBeInTheDocument();
    expect(screen.getByText('קשה')).toBeInTheDocument();
    expect(screen.getByText('מומחה')).toBeInTheDocument();
  });

  it('validates required fields on create simulation page', () => {
    render(
      <MemoryRouter initialEntries={['/simulations/new']}>
        <Routes>
          <Route path="/simulations/new" element={<CreateSimulation />} />
        </Routes>
      </MemoryRouter>
    );

    const submitBtn = screen.getByRole('button', { name: /המשך לבחירת אירועים/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText('נא להזין כותרת לסימולציה')).toBeInTheDocument();
    expect(screen.getByText('נא להזין תיאור מפורט לסימולציה')).toBeInTheDocument();
  });

  it('renders events selection page and tracks amount of selected events', () => {
    const testState = {
      title: 'תרגיל כוננות צפוני',
      description: 'תרחיש הדמיית אירוע חירום',
      difficulty: 'קשה' as const,
    };

    render(
      <MemoryRouter initialEntries={[{ pathname: '/simulations/events', state: testState }]}>
        <Routes>
          <Route path="/simulations/events" element={<SelectEvents />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('תרגיל כוננות צפוני')).toBeInTheDocument();
    expect(screen.getByText('רמת קושי: קשה')).toBeInTheDocument();

    // Initially 0 selected events
    expect(screen.getByText('טרם נבחרו אירועים לסימולציה זו')).toBeInTheDocument();

    // Add an event from catalog
    const addButtons = screen.getAllByRole('button', { name: /הוסף לסימולציה/i });
    expect(addButtons.length).toBeGreaterThan(0);
    fireEvent.click(addButtons[0]);

    // Amount of events in simulation should update
    expect(screen.getByText('נבחר לסימולציה')).toBeInTheDocument();
    expect(screen.getByText('אירועים בסימולציה (1)')).toBeInTheDocument();
  });
});
