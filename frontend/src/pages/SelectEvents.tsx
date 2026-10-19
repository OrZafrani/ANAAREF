import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  SimulationFormData,
  SimulationEvent,
  Simulation,
  EventCategory,
} from '../types/simulation';
import { PRESET_EVENTS } from '../data/presetEvents';
import {
  CheckIcon,
  PlusIcon,
  TrashIcon,
  ArrowRightIcon,
  LayersIcon,
  ClockIcon,
  CloseIcon,
} from '../components/Icons';
import './SelectEvents.css';

const CATEGORIES: ('הכל' | EventCategory)[] = [
  'הכל',
  'מבצעי',
  'התראה',
  'תקלה',
  'חירום',
  'תקשורת',
];

export default function SelectEvents() {
  const location = useLocation();
  const navigate = useNavigate();

  // Retrieve simulation info from location state or draft
  const [simData] = useState<SimulationFormData>(() => {
    const passed = location.state as SimulationFormData | undefined;
    if (passed && passed.title) {
      return passed;
    }
    try {
      const saved = sessionStorage.getItem('cobra_sim_draft');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return {
      title: 'סימולציה ללא שם',
      description: 'ללא תיאור מוגדר',
      difficulty: 'בינוני',
    };
  });

  const [availableEvents, setAvailableEvents] = useState<SimulationEvent[]>(PRESET_EVENTS);
  const [selectedEvents, setSelectedEvents] = useState<SimulationEvent[]>([]);
  const [activeCategory, setActiveCategory] = useState<'הכל' | EventCategory>('הכל');

  // Custom event form state
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customCategory, setCustomCategory] = useState<EventCategory>('מבצעי');
  const [customMinute, setCustomMinute] = useState<number>(10);
  const [customDescription, setCustomDescription] = useState('');
  const [customError, setCustomError] = useState('');

  // Success modal state
  const [savedSimulation, setSavedSimulation] = useState<Simulation | null>(null);

  const filteredCatalog = availableEvents.filter((evt) => {
    if (activeCategory === 'הכל') return true;
    return evt.category === activeCategory;
  });

  const isEventSelected = (id: string) => {
    return selectedEvents.some((e) => e.id === id);
  };

  const handleToggleEvent = (event: SimulationEvent) => {
    if (isEventSelected(event.id)) {
      setSelectedEvents(selectedEvents.filter((e) => e.id !== event.id));
    } else {
      setSelectedEvents([...selectedEvents, event]);
    }
  };

  const handleRemoveSelected = (id: string) => {
    setSelectedEvents(selectedEvents.filter((e) => e.id !== id));
  };

  const handleAddCustomEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) {
      setCustomError('נא להזין שם לאירוע');
      return;
    }

    const newEvent: SimulationEvent = {
      id: `custom-${Date.now()}`,
      title: customTitle.trim(),
      category: customCategory,
      minute: Number(customMinute) || 1,
      description: customDescription.trim() || 'אירוע מותאם אישית שנוצר על ידי המשתמש.',
    };

    setAvailableEvents([newEvent, ...availableEvents]);
    setSelectedEvents([...selectedEvents, newEvent]);

    // Reset custom form
    setCustomTitle('');
    setCustomDescription('');
    setCustomMinute(10);
    setCustomError('');
    setShowCustomForm(false);
  };

  const handleSaveSimulation = () => {
    if (selectedEvents.length === 0) {
      alert('נא לבחור לפחות אירוע אחד לסימולציה');
      return;
    }

    const newSimulation: Simulation = {
      id: `sim-${Date.now()}`,
      title: simData.title,
      description: simData.description,
      difficulty: simData.difficulty,
      events: selectedEvents,
      createdAt: new Date().toISOString(),
    };

    // Save into localStorage
    try {
      const existing = localStorage.getItem('cobra_simulations');
      const list: Simulation[] = existing ? JSON.parse(existing) : [];
      list.unshift(newSimulation);
      localStorage.setItem('cobra_simulations', JSON.stringify(list));
      sessionStorage.removeItem('cobra_sim_draft');
    } catch {
      // ignore
    }

    setSavedSimulation(newSimulation);
  };

  return (
    <div className="select-events-container">
      <div className="select-events-header">
        <nav className="events-breadcrumb">
          <button type="button" onClick={() => navigate('/')}>
            דף הבית
          </button>
          <span>/</span>
          <button type="button" onClick={() => navigate('/simulations/new')}>
            יצירת סימולציה
          </button>
          <span>/</span>
          <span>בחירת אירועים</span>
        </nav>
        <h1 className="select-events-title">בחירת אירועים לסימולציה</h1>
        <p className="select-events-subtitle">
          כל סימולציה כוללת כמות אירועים. בחר אירועים ממאגר התרחישים או הוסף אירוע מותאם
        </p>
      </div>

      {/* Stepper */}
      <div className="events-stepper-bar">
        <button
          type="button"
          className="events-stepper-item events-stepper-clickable events-stepper-completed"
          onClick={() => navigate('/simulations/new')}
          title="חזרה לעריכת פרטי הסימולציה"
        >
          <span className="events-stepper-num">
            <CheckIcon size={14} />
          </span>
          <span>פרטי הסימולציה</span>
        </button>
        <div className="events-stepper-divider" />
        <div className="events-stepper-item events-stepper-item-active">
          <span className="events-stepper-num">2</span>
          <span>בחירת אירועים</span>
        </div>
      </div>

      {/* Simulation Info Banner */}
      <div className="sim-summary-banner">
        <div className="sim-summary-info">
          <div className="sim-summary-title-row">
            <h2 className="sim-summary-title">{simData.title}</h2>
            <span className={`difficulty-tag difficulty-tag-${simData.difficulty}`}>
              רמת קושי: {simData.difficulty}
            </span>
          </div>
          <p className="sim-summary-desc">{simData.description}</p>
        </div>

        <div className="sim-counter-card">
          <span className="sim-counter-badge">{selectedEvents.length}</span>
          <div className="sim-counter-label-group">
            <span className="sim-counter-title">כמות אירועים</span>
            <span className="sim-counter-desc">נבחרו לסימולציה זו</span>
          </div>
          <LayersIcon size={20} className="icon-muted" />
        </div>
      </div>

      {/* Workspace */}
      <div className="events-workspace">
        {/* Left Column: Catalog */}
        <section className="section-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">מאגר אירועים זמינים</h3>
              <span className="panel-subtitle">סנן ובחר אירועים לתרחיש</span>
            </div>
          </div>

          {/* Category Filters */}
          <div className="category-filter-list">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`category-filter-btn ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Events Catalog */}
          <div className="events-list">
            {filteredCatalog.map((event) => {
              const selected = isEventSelected(event.id);
              return (
                <div
                  key={event.id}
                  className={`event-item-card ${selected ? 'is-selected' : ''}`}
                >
                  <div className="event-card-header">
                    <h4 className="event-card-title">{event.title}</h4>
                    <div className="event-card-badges">
                      <span className={`cat-badge cat-badge-${event.category}`}>
                        {event.category}
                      </span>
                      <span className="time-badge">
                        <ClockIcon size={12} />
                        <span>דקה {event.minute}</span>
                      </span>
                    </div>
                  </div>
                  <p className="event-card-desc">{event.description}</p>
                  <div className="event-card-actions">
                    <button
                      type="button"
                      className={`add-event-btn ${selected ? 'added' : ''}`}
                      onClick={() => handleToggleEvent(event)}
                    >
                      {selected ? (
                        <>
                          <CheckIcon size={14} />
                          <span>נבחר לסימולציה</span>
                        </>
                      ) : (
                        <>
                          <PlusIcon size={14} />
                          <span>הוסף לסימולציה</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom Event Creator */}
          {!showCustomForm ? (
            <button
              type="button"
              className="custom-event-toggle-btn"
              onClick={() => setShowCustomForm(true)}
            >
              <PlusIcon size={16} />
              <span>הוסף אירוע מותאם אישית</span>
            </button>
          ) : (
            <form className="custom-event-form" onSubmit={handleAddCustomEvent}>
              <h4 className="custom-form-title">הגדרת אירוע חדש</h4>
              {customError && <p className="error-text">{customError}</p>}

              <div className="form-group">
                <label className="form-label">שם האירוע</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="לדוגמה: ניתוק מערכות קשר גדודי"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                />
              </div>

              <div className="custom-form-row">
                <div className="form-group">
                  <label className="form-label">סיווג אירוע</label>
                  <select
                    className="form-input"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value as EventCategory)}
                  >
                    <option value="מבצעי">מבצעי</option>
                    <option value="התראה">התראה</option>
                    <option value="תקלה">תקלה</option>
                    <option value="חירום">חירום</option>
                    <option value="תקשורת">תקשורת</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">תזמון (דקה בסימולציה)</label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    className="form-input"
                    value={customMinute}
                    onChange={(e) => setCustomMinute(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">תיאור האירוע</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="פירוט המתרחש באירוע זה..."
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                />
              </div>

              <div className="custom-form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCustomForm(false)}
                >
                  ביטול
                </button>
                <button type="submit" className="btn-primary">
                  הוסף אירוע
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Right Column: Selected Events in Simulation */}
        <section className="section-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">
                אירועים בסימולציה ({selectedEvents.length})
              </h3>
              <span className="panel-subtitle">סדר האירועים הנבחרים</span>
            </div>
            {selectedEvents.length > 0 && (
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
                onClick={() => setSelectedEvents([])}
              >
                נקה הכל
              </button>
            )}
          </div>

          {selectedEvents.length === 0 ? (
            <div className="empty-selected-state">
              <LayersIcon size={32} />
              <p>טרם נבחרו אירועים לסימולציה זו</p>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                בחר אירועים ממאגר התרחישים משמאל להרכבת הסימולציה
              </span>
            </div>
          ) : (
            <div className="selected-events-list">
              {selectedEvents.map((evt, idx) => (
                <div key={evt.id} className="selected-event-item">
                  <span className="selected-event-order">{idx + 1}</span>
                  <div className="selected-event-details">
                    <h5 className="selected-event-title">{evt.title}</h5>
                    <div className="selected-event-meta">
                      <span>סוג: {evt.category}</span>
                      <span>•</span>
                      <span>דקה {evt.minute}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="remove-event-btn"
                    onClick={() => handleRemoveSelected(evt.id)}
                    title="הסר אירוע מהסימולציה"
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Bottom Actions Bar */}
      <div className="events-bottom-actions">
        <p className="bottom-info-note">
          {selectedEvents.length === 0
            ? 'יש לבחור לפחות אירוע אחד כדי להשלים את יצירת הסימולציה.'
            : `הסימולציה מוכנה עם ${selectedEvents.length} אירועים מבצעיים.`}
        </p>

        <div className="bottom-buttons">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/simulations/new')}
          >
            <ArrowRightIcon size={16} />
            <span>חזרה לעריכת פרטים</span>
          </button>

          <button
            type="button"
            className="btn-success"
            disabled={selectedEvents.length === 0}
            onClick={handleSaveSimulation}
          >
            <CheckIcon size={16} />
            <span>שמור סימולציה</span>
          </button>
        </div>
      </div>

      {/* Success Modal */}
      {savedSimulation && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card success-modal-card">
            <div className="modal-header">
              <div className="modal-header-text">
                <h2>הסימולציה נשמרה בהצלחה</h2>
                <p>התרחיש הוגדר ומוכן לשימוש במערכת</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => navigate('/')}
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <div className="success-body">
              <div className="success-icon-banner">
                <CheckIcon size={24} />
              </div>

              <h3>{savedSimulation.title}</h3>
              <p>{savedSimulation.description}</p>

              <div className="success-details-box">
                <div className="success-detail-row">
                  <span className="success-label">רמת קושי:</span>
                  <span className="success-val">{savedSimulation.difficulty}</span>
                </div>
                <div className="success-detail-row">
                  <span className="success-label">כמות אירועים בסימולציה:</span>
                  <span className="success-val">
                    {savedSimulation.events.length} אירועים
                  </span>
                </div>
                <div className="success-detail-row">
                  <span className="success-label">תאריך יצירה:</span>
                  <span className="success-val">
                    {new Date(savedSimulation.createdAt).toLocaleDateString('he-IL')}
                  </span>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setSavedSimulation(null);
                  setSelectedEvents([]);
                  navigate('/simulations/new');
                }}
              >
                יצירת סימולציה נוספת
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => navigate('/')}
              >
                חזרה לדף הבית
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
