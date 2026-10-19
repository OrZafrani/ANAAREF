import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BuilderHeader from '../components/BuilderHeader';
import ContentLibraryModal from '../components/ContentLibraryModal';
import { SimulationFormData, SimulationEvent } from '../types/simulation';
import { PRESET_EVENTS } from '../data/presetEvents';
import { createSimulation } from '../lib/api';
import {
  CheckIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  CloseIcon,
  ContentLibraryIcon,
  LayersIcon,
  PlusIcon,
} from '../components/Icons';
import './SelectEvents.css';

const DIFFICULTY_DURATION_MAP: Record<string, number> = {
  קל: 20,
  בינוני: 30,
  קשה: 45,
  מומחה: 60,
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
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  // Success modal
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const selectedIds = new Set(selectedEvents.map((e) => e.id));
  const simDuration = DIFFICULTY_DURATION_MAP[simData.difficulty] ?? 30;

  const handleToggleEvent = (event: SimulationEvent) => {
    if (selectedIds.has(event.id)) {
      setSelectedEvents(selectedEvents.filter((e) => e.id !== event.id));
    } else {
      setSelectedEvents([...selectedEvents, event]);
    }
  };

  const handleRemoveSelected = (id: string) => {
    setSelectedEvents(selectedEvents.filter((e) => e.id !== id));
  };

  const handleAddCustomEvent = (newEvent: SimulationEvent) => {
    setAvailableEvents([newEvent, ...availableEvents]);
    setSelectedEvents([...selectedEvents, newEvent]);
  };

  const handleSaveSimulation = async () => {
    if (selectedEvents.length === 0) {
      alert('נא לבחור לפחות אירוע אחד לסימולציה');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    try {
      await createSimulation({ ...simData, events: selectedEvents });
      sessionStorage.removeItem('cobra_sim_draft');
      setIsSavedSuccess(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save simulation.');
    } finally {
      setIsSaving(false);
    }
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
        {saveError && <p role="alert">{saveError}</p>}
        {currentStep === 2 ? (
          <>
            {/* Single content card matching mockup */}
            <section className="builder-card content-step-card">
              <div className="content-card-top">
                <div className="content-card-title-group">
                  <span className="content-count-badge">{selectedEvents.length}</span>
                  <h3 className="builder-card-title">דיווחים שנבחרו לסימולציה</h3>
                  <ContentLibraryIcon size={16} />
                </div>
                <div className="content-card-actions">
                  <span className="content-duration-label">{simDuration} דק׳</span>
                  <button
                    type="button"
                    className="btn-add-from-library"
                    onClick={() => setIsLibraryOpen(true)}
                  >
                    <PlusIcon size={15} />
                    <span>הוספה מהספרייה</span>
                  </button>
                </div>
              </div>

              <div className="builder-card-divider" />

              {selectedEvents.length === 0 ? (
                <div className="content-empty-state">
                  <span className="content-empty-icon">
                    <LayersIcon size={22} />
                  </span>
                  <h4>עדיין לא נוסף תוכן</h4>
                  <p>
                    הוסיפו דיווחים מהספרייה התוכן, אפשר לבחור בכמה דקות, והלחצים
                    <br />
                    משמאלם לכל פריט.
                  </p>
                </div>
              ) : (
                <div className="selected-scroll-list content-selected-list">
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
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Bottom Bar for Step 2 */}
            <div className="builder-bottom-bar">
              <button
                type="button"
                className="btn-bottom-prev"
                onClick={() => navigate('/simulations/new')}
              >
                <ArrowRightIcon size={16} />
                <span>הקודם</span>
              </button>

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
                <span>סקירה ושמירה</span>
                <ArrowLeftIcon size={16} />
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
                  <p style={{ margin: 0, fontSize: '0.86rem', color: '#6b7280', lineHeight: 1.5, direction: 'rtl', textAlign: 'start' }}>
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
                className="btn-bottom-prev"
                onClick={() => setCurrentStep(2)}
              >
                <ArrowRightIcon size={16} />
                <span>הקודם</span>
              </button>

              <button
                type="button"
                className="btn-bottom-next"
                disabled={isSaving}
                onClick={handleSaveSimulation}
              >
                <CheckIcon size={16} />
                <span>{isSaving ? 'שומר...' : 'שמירה ואישור'}</span>
              </button>
            </div>
          </>
        )}
      </main>

      {/* Content Library Modal */}
      <ContentLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        availableEvents={availableEvents}
        selectedIds={selectedIds}
        onToggle={handleToggleEvent}
        onAddCustom={handleAddCustomEvent}
      />

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

            <div className="modal-footer" style={{ gap: '0.75rem', justifyContent: 'flex-start' }}>
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
