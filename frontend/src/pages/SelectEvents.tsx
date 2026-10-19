import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BuilderHeader from '../components/BuilderHeader';
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
  ArrowLeftIcon,
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

const DIFFICULTY_METRICS_MAP: Record<string, string> = {
  קל: "2/דק'  ·  20 דק'  ·  5/5/10%",
  בינוני: "4/דק'  ·  30 דק'  ·  15/10/25%",
  קשה: "8/דק'  ·  45 דק'  ·  25/20/40%",
  מומחה: "12/דק'  ·  60 דק'  ·  35/30/50%",
};

export default function SelectEvents() {
  const location = useLocation();
  const navigate = useNavigate();

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
      description: '',
      difficulty: 'בינוני',
    };
  });

  const [currentStep, setCurrentStep] = useState<2 | 3>(2);
  const [availableEvents, setAvailableEvents] = useState<SimulationEvent[]>(PRESET_EVENTS);
  const [selectedEvents, setSelectedEvents] = useState<SimulationEvent[]>([]);
  const [activeCategory, setActiveCategory] = useState<'הכל' | EventCategory>('הכל');

  // Custom event state
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customCategory, setCustomCategory] = useState<EventCategory>('מבצעי');
  const [customMinute, setCustomMinute] = useState<number>(10);
  const [customDescription, setCustomDescription] = useState('');
  const [customError, setCustomError] = useState('');

  // Success modal
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);

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

    try {
      const existing = localStorage.getItem('cobra_simulations');
      const list: Simulation[] = existing ? JSON.parse(existing) : [];
      list.unshift(newSimulation);
      localStorage.setItem('cobra_simulations', JSON.stringify(list));
      sessionStorage.removeItem('cobra_sim_draft');
    } catch {
      // ignore
    }

    setIsSavedSuccess(true);
  };

  return (
    <div className="builder-page-wrapper">
      <BuilderHeader
        title={simData.title}
        currentStep={currentStep}
        onStepClick={(step) => {
          if (step === 1) {
            navigate('/simulations/new');
          } else if (step === 2) {
            setCurrentStep(2);
          } else if (step === 3 && selectedEvents.length > 0) {
            setCurrentStep(3);
          }
        }}
        onSaveDraft={() => {
          try {
            sessionStorage.setItem(
              'cobra_sim_draft',
              JSON.stringify({ ...simData, events: selectedEvents })
            );
          } catch {
            // ignore
          }
        }}
        onSave={handleSaveSimulation}
        isSaved={true}
      />

      <main className="events-builder-body">
        {currentStep === 2 ? (
          <>
            {/* Metric Banner Card */}
            <div className="events-metric-banner">
              <div className="metric-banner-info">
                <h2>הגדרות תוכן והזרמת אירועים</h2>
                <p>
                  הסימולציה נבנית עבור SPECTRE. בחר את האירועים וההסחות שיוזרמו במהלך התרחיש המבצעי.
                </p>
              </div>

              <div className="metric-stat-group">
                <div className="metric-stat-pill">
                  <span className="metric-stat-label">רמת קושי</span>
                  <span className="metric-stat-value">{simData.difficulty}</span>
                </div>

                <div className="metric-stat-pill">
                  <span className="metric-stat-label">קצב הזרמה</span>
                  <span className="metric-stat-value" style={{ fontSize: '0.85rem' }}>
                    {DIFFICULTY_METRICS_MAP[simData.difficulty] || "4/דק'"}
                  </span>
                </div>

                <div className="metric-stat-pill highlight">
                  <span className="metric-stat-label">אירועים שנבחרו</span>
                  <span className="metric-stat-value">{selectedEvents.length}</span>
                </div>
              </div>
            </div>

            {/* Events Workspace Columns */}
            <div className="events-columns-grid">
              {/* Catalog Section */}
              <section className="builder-card">
                <div className="builder-card-header">
                  <h3 className="builder-card-title">מאגר אירועים והזרמות</h3>
                  <p className="builder-card-subtitle">
                    בחר אירועים מהמאגר המבצעי לשיבוץ במהלך הסימולציה
                  </p>
                </div>

                <div className="builder-card-divider" />

                {/* Category Filters */}
                <div className="filter-pills-row">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`filter-pill ${activeCategory === cat ? 'active' : ''}`}
                      onClick={() => setActiveCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Catalog List */}
                <div className="catalog-scroll-list">
                  {filteredCatalog.map((event) => {
                    const selected = isEventSelected(event.id);
                    return (
                      <div
                        key={event.id}
                        className={`catalog-event-box ${selected ? 'is-added' : ''}`}
                      >
                        <div className="box-top-line">
                          <h4 className="box-title">{event.title}</h4>
                          <div className="box-tags">
                            <span className={`tag-cat tag-cat-${event.category}`}>
                              {event.category}
                            </span>
                            <span className="tag-minute">דקה {event.minute}</span>
                          </div>
                        </div>

                        <p className="box-desc">{event.description}</p>

                        <div className="box-actions">
                          <button
                            type="button"
                            className={`btn-add-event ${selected ? 'added' : ''}`}
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
                    className="btn-toggle-custom"
                    onClick={() => setShowCustomForm(true)}
                  >
                    <PlusIcon size={16} />
                    <span>הוסף אירוע מותאם אישית</span>
                  </button>
                ) : (
                  <form className="custom-event-card" onSubmit={handleAddCustomEvent}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                      הגדרת אירוע מותאם
                    </h4>
                    {customError && <p className="builder-error-msg">{customError}</p>}

                    <div className="builder-form-group">
                      <label className="builder-label">שם האירוע</label>
                      <input
                        type="text"
                        className="builder-input"
                        placeholder="לדוגמה: ניתוק מערכות קשר גדודי"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="builder-form-group">
                        <label className="builder-label">סיווג</label>
                        <select
                          className="builder-input"
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

                      <div className="builder-form-group">
                        <label className="builder-label">דקת תזמון</label>
                        <input
                          type="number"
                          min="1"
                          max="180"
                          className="builder-input"
                          value={customMinute}
                          onChange={(e) => setCustomMinute(Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="builder-form-group">
                      <label className="builder-label">תיאור האירוע</label>
                      <textarea
                        className="builder-textarea"
                        rows={2}
                        placeholder="פירוט המתרחש באירוע..."
                        value={customDescription}
                        onChange={(e) => setCustomDescription(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn-bottom-prev"
                        style={{ padding: '0.4rem 0.85rem' }}
                        onClick={() => setShowCustomForm(false)}
                      >
                        ביטול
                      </button>
                      <button
                        type="submit"
                        className="btn-bottom-next"
                        style={{ padding: '0.4rem 1.1rem' }}
                      >
                        הוסף אירוע
                      </button>
                    </div>
                  </form>
                )}
              </section>

              {/* Selected Events Section */}
              <section className="builder-card">
                <div className="builder-card-header">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="builder-card-title">
                      אירועים בסימולציה ({selectedEvents.length})
                    </h3>
                    {selectedEvents.length > 0 && (
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#6b7280',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                        onClick={() => setSelectedEvents([])}
                      >
                        נקה הכל
                      </button>
                    )}
                  </div>
                  <p className="builder-card-subtitle">
                    רשימת האירועים שירוצו לפי סדר התזמון
                  </p>
                </div>

                <div className="builder-card-divider" />

                {selectedEvents.length === 0 ? (
                  <div className="empty-selected-box">
                    <p>טרם נבחרו אירועים לסימולציה זו</p>
                    <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                      בחר אירועים מהמאגר מימין להרכבת התרחיש
                    </span>
                  </div>
                ) : (
                  <div className="selected-scroll-list">
                    {selectedEvents.map((evt, idx) => (
                      <div key={evt.id} className="selected-item-row">
                        <span className="selected-seq">{idx + 1}</span>
                        <div className="selected-text">
                          <h5 className="selected-text-title">{evt.title}</h5>
                          <div className="selected-text-sub">
                            <span>סיווג: {evt.category}</span>
                            <span>•</span>
                            <span>דקה {evt.minute}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-remove-item"
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

            {/* Bottom Bar for Step 2 */}
            <div className="builder-bottom-bar">
              <button
                type="button"
                className="btn-bottom-next"
                disabled={selectedEvents.length === 0}
                onClick={() => {
                  if (selectedEvents.length === 0) {
                    alert('נא לבחור לפחות אירוע אחד לסימולציה');
                    return;
                  }
                  setCurrentStep(3);
                }}
              >
                <span>הבא</span>
                <ArrowLeftIcon size={16} />
              </button>

              <button
                type="button"
                className="btn-bottom-prev"
                onClick={() => navigate('/simulations/new')}
              >
                <ArrowRightIcon size={16} />
                <span>הקודם</span>
              </button>
            </div>
          </>
        ) : (
          /* Step 3: סקירה ושמירה */
          <>
            <section className="builder-card">
              <div className="builder-card-header">
                <h2 className="builder-card-title">סקירה ושמירת סימולציה</h2>
                <p className="builder-card-subtitle">
                  בדוק את פרטי הסימולציה והאירועים שנבחרו לפני השמירה הסופית
                </p>
              </div>

              <div className="builder-card-divider" />

              <div className="review-grid-info">
                <div className="review-info-item">
                  <span className="review-item-label">שם הסימולציה:</span>
                  <span className="review-item-val">{simData.title}</span>
                </div>
                <div className="review-info-item">
                  <span className="review-item-label">רמת קושי:</span>
                  <span className="review-item-val">{simData.difficulty}</span>
                </div>
                <div className="review-info-item">
                  <span className="review-item-label">כמות אירועים:</span>
                  <span className="review-item-val">{selectedEvents.length} אירועים</span>
                </div>
              </div>

              {simData.description && (
                <div style={{ marginTop: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '0.9rem', color: '#374151' }}>
                    תיאור התרחיש:
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.86rem', color: '#6b7280', lineHeight: 1.5 }}>
                    {simData.description}
                  </p>
                </div>
              )}

              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.92rem', color: '#111827' }}>
                  רשימת אירועי התרחיש ({selectedEvents.length}):
                </h4>
                <div className="selected-scroll-list">
                  {selectedEvents.map((evt, idx) => (
                    <div key={evt.id} className="selected-item-row">
                      <span className="selected-seq">{idx + 1}</span>
                      <div className="selected-text">
                        <h5 className="selected-text-title">{evt.title}</h5>
                        <div className="selected-text-sub">
                          <span>סיווג: {evt.category}</span>
                          <span>•</span>
                          <span>דקה {evt.minute}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Bottom Bar for Step 3 */}
            <div className="builder-bottom-bar">
              <button
                type="button"
                className="btn-bottom-next"
                onClick={handleSaveSimulation}
              >
                <CheckIcon size={16} />
                <span>שמירה ואישור</span>
              </button>

              <button
                type="button"
                className="btn-bottom-prev"
                onClick={() => setCurrentStep(2)}
              >
                <ArrowRightIcon size={16} />
                <span>הקודם</span>
              </button>
            </div>
          </>
        )}
      </main>

      {/* Success Modal */}
      {isSavedSuccess && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div className="modal-header-text">
                <h2>הסימולציה נשמרה בהצלחה</h2>
                <p>התרחיש המבצעי הוקם ומוכן להפעלה במערכת SPECTRE</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => navigate('/')}
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <div style={{ padding: '1.5rem 1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <span style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #a7f3d0'
                }}>
                  <CheckIcon size={20} />
                </span>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#111827' }}>{simData.title}</h4>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    רמת קושי: {simData.difficulty} · {selectedEvents.length} אירועים
                  </span>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ gap: '0.75rem' }}>
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => {
                  setIsSavedSuccess(false);
                  navigate('/simulations/new');
                }}
              >
                יצירת סימולציה נוספת
              </button>
              <button
                type="button"
                className="top-gold-btn"
                onClick={() => navigate('/')}
              >
                חזרה ללוח הבקרה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
