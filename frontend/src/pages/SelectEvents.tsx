import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BuilderHeader from '../components/BuilderHeader';
import ContentLibraryModal from '../components/ContentLibraryModal';
import { SimulationFormData, SimulationEvent } from '../types/simulation';
import { createSimulation } from '../lib/api';
import { getCategoryTree, getTemplates, type CategoryNode, type LibraryTemplate } from '../lib/libraryApi';
import { SYSTEM_INFO, useAppSettings } from '../lib/appSettings';
import { getUrgency } from '../lib/urgency';
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

function simDurationCap(difficulty: string): number {
  return DIFFICULTY_DURATION_MAP[difficulty] ?? 30;
}

function nextLibraryMinute(events: SimulationEvent[], duration: number): number | null {
  const libraryEvents = events.filter((event) => event.reportUrl);
  const occupiedMinutes = new Set(libraryEvents.map((event) => event.minute));
  for (let minute = (libraryEvents.length + 1) * 2; minute <= duration; minute += 2) {
    if (!occupiedMinutes.has(minute)) return minute;
  }
  return null;
}

function timelineMinuteAtPosition(clientX: number, left: number, width: number, duration: number): number | null {
  if (width === 0) return null;
  const position = Math.min(1, Math.max(0, (clientX - left) / width));
  return Math.min(duration, Math.max(1, Math.round((1 - position) * duration)));
}

function SelectedEventRow({
  event,
  index,
  duration,
  isActive,
  onMinuteChange,
  onRemove,
}: {
  event: SimulationEvent;
  index: number;
  duration: number;
  isActive: boolean;
  onMinuteChange: (id: string, minute: number) => void;
  onRemove?: (id: string) => void;
}) {
  return (
    <div
      className={`selected-item-row${isActive ? ' is-active' : ''}`}
      id={`selected-event-${event.id}`}
      tabIndex={-1}
    >
      <span className="selected-seq">{index + 1}</span>
      <div className="selected-text">
        <h5 className="selected-text-title">{event.title}</h5>
        <div className="selected-text-sub">
          <span>קטגוריה: {event.categoryName ?? event.category}{event.subCategory ? ` · ${event.subCategory}` : ''}</span>
          <span>•</span>
          <label className="selected-minute-control">
            דקה בסימולציה:
            <input
              type="number"
              min="1"
              max={duration}
              step="1"
              value={event.minute}
              aria-label={`דקת סימולציה עבור ${event.title}`}
              onChange={(changeEvent) => onMinuteChange(event.id, Number(changeEvent.currentTarget.value))}
            />
          </label>
          <span>•</span>
          <span>דחיפות: {getUrgency(event.threatLevel).label}</span>
        </div>
      </div>
      {onRemove && (
        <button
          type="button"
          className="btn-remove-item"
          onClick={() => onRemove(event.id)}
          title="הסר אירוע מהסימולציה"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default function SelectEvents() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sys } = useAppSettings();

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
  // Library templates from the DB (ספריית התוכן = report_templates).
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [templates, setTemplates] = useState<LibraryTemplate[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [libraryError, setLibraryError] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryCategoryId, setLibraryCategoryId] = useState<string>('');
  const [librarySubCategoryId, setLibrarySubCategoryId] = useState<string>('');
  const [selectedEvents, setSelectedEvents] = useState<SimulationEvent[]>([]);
  const [activeTimelineEventId, setActiveTimelineEventId] = useState<string | null>(null);
  const [pendingTimelineMinute, setPendingTimelineMinute] = useState<number | null>(null);
  const [selectionError, setSelectionError] = useState('');
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const subCategories = useMemo(() => {
    if (!libraryCategoryId) return [];
    return categories.find((c) => c.id === libraryCategoryId)?.sub_categories ?? [];
  }, [categories, libraryCategoryId]);

  const toEventCategory = (template: LibraryTemplate): SimulationEvent['category'] => {
    const haystack = [
      template.category_name,
      template.sub_category_name,
      ...(template.matches ?? []),
      template.report_title ?? '',
    ].join(' ');
    if (/התראה/.test(haystack)) return 'התראה';
    if (/תקלה/.test(haystack)) return 'תקלה';
    if (/חירום/.test(haystack)) return 'חירום';
    if (/תקשורת/.test(haystack)) return 'תקשורת';
    return 'מבצעי';
  };

  // DB-driven library: every template in ספריית התוכן is a candidate event.
  const availableEvents: SimulationEvent[] = useMemo(() => {
    const cap = simDurationCap(simData.difficulty);
    const nextMinute = nextLibraryMinute(selectedEvents, cap);
    return templates.map((template) => {
      const selectedEvent = selectedEvents.find((event) => event.id === template.id);
      return {
        id: template.id,
        title: template.report_title || 'תבנית ללא כותרת',
        category: toEventCategory(template),
        categoryName: template.category_name ?? undefined,
        categoryId: template.category_id,
        subCategory: template.sub_category_name ?? undefined,
        subCategoryId: template.sub_category_id,
        reportUrl: template.report_url,
        matches: template.matches ?? undefined,
        city: template.city,
        country: template.country,
        threatLevel: template.threat_level,
        minute: selectedEvent?.minute ?? nextMinute ?? cap,
        description: template.original_content?.slice(0, 500) || template.report_title || 'דיווח מספריית התוכן.',
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, selectedEvents, simData.difficulty]);

  // Load category tree once for the filter dropdowns.
  useEffect(() => {
    let active = true;
    getCategoryTree()
      .then((tree) => { if (active) setCategories(tree); })
      .catch((error) => {
        if (active) setLibraryError(error instanceof Error ? error.message : 'טעינת הספרייה נכשלה');
      });
    return () => { active = false; };
  }, []);

  // Load templates from the DB whenever the search / category filter changes.
  // Debounced so typing doesn't spam the API.
  useEffect(() => {
    let active = true;
    setIsLoadingLibrary(true);
    const timer = setTimeout(async () => {
      try {
        const results = await getTemplates({
          search: librarySearch.trim() || undefined,
          categoryId: libraryCategoryId || undefined,
          subCategoryId: librarySubCategoryId || undefined,
        });
        if (active) {
          setTemplates(results);
          setLibraryError('');
        }
      } catch (error) {
        if (active) {
          setTemplates([]);
          setLibraryError(error instanceof Error ? error.message : 'טעינת הספרייה נכשלה');
        }
      } finally {
        if (active) setIsLoadingLibrary(false);
      }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [librarySearch, libraryCategoryId, librarySubCategoryId]);

  // Success modal
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const selectedIds = new Set(selectedEvents.map((e) => e.id));
  const simDuration = DIFFICULTY_DURATION_MAP[simData.difficulty] ?? 30;

  const handleToggleEvent = (event: SimulationEvent) => {
    if (selectedIds.has(event.id)) {
      setSelectedEvents(selectedEvents.filter((e) => e.id !== event.id));
      setSelectionError('');
    } else {
      const minute = pendingTimelineMinute ?? (event.reportUrl ? nextLibraryMinute(selectedEvents, simDuration) : event.minute);
      if (minute === null) {
        setSelectionError(`לא ניתן להוסיף דיווח נוסף: משך הסימולציה מאפשר עד ${Math.floor(simDuration / 2)} דיווחים במרווחים של שתי דקות.`);
        return;
      }
      if (pendingTimelineMinute !== null && selectedEvents.some((selectedEvent) => selectedEvent.minute === minute)) {
        setSelectionError(`כבר קיים אירוע בדקה ${minute}. לחצו על מקום פנוי אחר בציר הזמן.`);
        return;
      }
      setSelectedEvents([...selectedEvents, { ...event, minute }]);
      setSelectionError('');
      if (pendingTimelineMinute !== null) {
        setActiveTimelineEventId(event.id);
        setPendingTimelineMinute(null);
        setIsLibraryOpen(false);
      }
    }
  };

  const handleRemoveSelected = (id: string) => {
    setSelectedEvents(selectedEvents.filter((e) => e.id !== id));
    setSelectionError('');
  };

  const handleAddCustomEvent = (newEvent: SimulationEvent) => {
    const event = pendingTimelineMinute === null
      ? newEvent
      : { ...newEvent, minute: pendingTimelineMinute };
    setSelectedEvents([...selectedEvents, event]);
    setSelectionError('');
    if (pendingTimelineMinute !== null) {
      setActiveTimelineEventId(event.id);
      setPendingTimelineMinute(null);
      setIsLibraryOpen(false);
    }
  };

  const handleAddAllFromLibrary = () => {
    const existing = new Set(selectedEvents.map((e) => e.id));
    const missing = availableEvents.filter((e) => !existing.has(e.id));
    const addedEvents: SimulationEvent[] = [];
    for (const event of missing) {
      const minute = nextLibraryMinute([...selectedEvents, ...addedEvents], simDuration);
      if (minute === null) break;
      addedEvents.push({ ...event, minute });
    }
    if (addedEvents.length > 0) {
      setSelectedEvents([...selectedEvents, ...addedEvents]);
    }
    setSelectionError(addedEvents.length < missing.length
      ? `לא ניתן להוסיף את כל הדיווחים. נוספו ${addedEvents.length} מתוך ${missing.length}; משך הסימולציה מאפשר עד ${Math.floor(simDuration / 2)} דיווחים במרווחים של שתי דקות.`
      : '');
  };

  const handleMinuteChange = (id: string, minute: number) => {
    if (!Number.isInteger(minute) || minute < 1 || minute > simDuration) return;
    setSelectedEvents(selectedEvents.map((event) => event.id === id ? { ...event, minute } : event));
  };

  const handleTimelineEventClick = (id: string, event: MouseEvent<HTMLButtonElement>) => {
    const track = event.currentTarget.closest('.event-timeline-track');
    if (event.detail !== 0 && track) {
      const { left, width } = track.getBoundingClientRect();
      const clickedMinute = timelineMinuteAtPosition(event.clientX, left, width, simDuration);
      const selectedEvent = selectedEvents.find((selectedEvent) => selectedEvent.id === id);
      if (clickedMinute !== null && clickedMinute !== selectedEvent?.minute) return;
    }
    setActiveTimelineEventId(id);
    document.getElementById(`selected-event-${id}`)?.scrollIntoView?.({
      behavior: 'smooth',
      block: 'center',
    });
  };

  const handleEmptyTimelineClick = (event: MouseEvent<HTMLDivElement>) => {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const minute = timelineMinuteAtPosition(event.clientX, left, width, simDuration);
    if (minute === null) return;
    if (selectedEvents.some((selectedEvent) => selectedEvent.minute === minute)) return;
    setPendingTimelineMinute(minute);
    setSelectionError('');
    setIsLibraryOpen(true);
  };

  const handleSaveSimulation = async () => {
    if (selectedEvents.length === 0) {
      alert('נא לבחור לפחות אירוע אחד לסימולציה');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    try {
      await createSimulation({ ...simData, sys, events: selectedEvents });
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
        {libraryError && <p role="alert">שגיאה בטעינת ספריית התוכן: {libraryError}</p>}
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
                    className="btn-bottom-prev"
                    disabled={availableEvents.length === 0}
                    onClick={handleAddAllFromLibrary}
                    title="הוספת כל הדיווחים מהספרייה לסימולציה"
                  >
                    <PlusIcon size={15} />
                    <span>הוספת כל הספרייה ({availableEvents.length})</span>
                  </button>
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

              {/* DB-driven library filters: search + category + sub-category */}
              <div className="library-filter-row" style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1.25rem 0', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="builder-input"
                  placeholder="חיפוש דיווחים בספרייה..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  style={{ flex: '2 1 200px' }}
                  aria-label="חיפוש בספריית התוכן"
                />
                <select
                  className="builder-input"
                  value={libraryCategoryId}
                  onChange={(e) => { setLibraryCategoryId(e.target.value); setLibrarySubCategoryId(''); }}
                  style={{ flex: '1 1 150px' }}
                  aria-label="סינון לפי קטגוריה"
                >
                  <option value="">כל הקטגוריות</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.report_count})</option>
                  ))}
                </select>
                {subCategories.length > 0 && (
                  <select
                    className="builder-input"
                    value={librarySubCategoryId}
                    onChange={(e) => setLibrarySubCategoryId(e.target.value)}
                    style={{ flex: '1 1 150px' }}
                    aria-label="סינון לפי תת-קטגוריה"
                  >
                    <option value="">כל תתי-הקטגוריות</option>
                    {subCategories.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.report_count})</option>
                    ))}
                  </select>
                )}
              </div>

              {isLoadingLibrary && <p role="status" style={{ padding: '0.5rem 1.25rem 0' }}>טוען דיווחים מספריית התוכן...</p>}
              {!isLoadingLibrary && !libraryError && (
                <p style={{ padding: '0.5rem 1.25rem 0', fontSize: '0.85rem', color: '#6b7280' }}>
                  {availableEvents.length} דיווחים זמינים מספריית התוכן
                </p>
              )}

              <div className="builder-card-divider" />

              <section className="event-timeline" aria-labelledby="event-timeline-title">
                <h4 className="event-timeline-title" id="event-timeline-title">ציר זמן של אירועי הסימולציה</h4>
                {selectedEvents.length === 0 && (
                  <p className="event-timeline-empty">לחצו על מקום פנוי בציר כדי להוסיף אירוע בדקה הזו.</p>
                )}
                <div className="event-timeline-scale">
                  <div className="event-timeline-track" onClick={handleEmptyTimelineClick}>
                    <div className="event-timeline-axis" aria-hidden="true" />
                    <ol className="event-timeline-list" aria-label="אירועים לפי זמן בסימולציה">
                      {[...selectedEvents]
                        .sort((left, right) => left.minute - right.minute)
                        .map((event) => (
                          <li
                            className="event-timeline-item"
                            key={event.id}
                            style={{ right: `${(event.minute / simDuration) * 100}%` }}
                          >
                            <button
                              type="button"
                              className={`event-timeline-point urgency-${getUrgency(event.threatLevel).level}${activeTimelineEventId === event.id ? ' is-active' : ''}`}
                              aria-label={`מעבר לאירוע ${event.title}, דקה ${event.minute}`}
                              aria-pressed={activeTimelineEventId === event.id}
                              title={`${event.title} · דקה ${event.minute}`}
                              onClick={(clickEvent) => handleTimelineEventClick(event.id, clickEvent)}
                            >
                              <span className="event-timeline-marker" aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                    </ol>
                    <div className="event-timeline-ticks" aria-hidden="true">
                      {[...new Set(selectedEvents.map((event) => event.minute))]
                        .sort((left, right) => left - right)
                        .map((minute) => (
                          <span
                            className="event-timeline-tick"
                            key={minute}
                            style={{ right: `${(minute / simDuration) * 100}%` }}
                          >
                            {minute}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              </section>

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
                <>
                  {selectionError && <p className="builder-error-msg" role="alert">{selectionError}</p>}
                  <div className="selected-scroll-list content-selected-list">
                    {selectedEvents.map((event, index) => (
                      <SelectedEventRow
                        key={event.id}
                        event={event}
                        index={index}
                        duration={simDuration}
                        isActive={activeTimelineEventId === event.id}
                        onMinuteChange={handleMinuteChange}
                        onRemove={handleRemoveSelected}
                      />
                    ))}
                  </div>
                </>
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
                  <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '0.9rem', color: 'var(--ink-2)' }}>
                    תיאור התרחיש:
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--muted)', lineHeight: 1.5, direction: 'rtl', textAlign: 'start' }}>
                    {simData.description}
                  </p>
                </div>
              )}

              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.92rem', color: 'var(--ink)' }}>
                  רשימת אירועי התרחיש ({selectedEvents.length}):
                </h4>
                <div className="selected-scroll-list">
                  {selectedEvents.map((event, index) => (
                    <SelectedEventRow
                      key={event.id}
                      event={event}
                      index={index}
                      duration={simDuration}
                      isActive={activeTimelineEventId === event.id}
                      onMinuteChange={handleMinuteChange}
                    />
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

      <ContentLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => {
          setIsLibraryOpen(false);
          setPendingTimelineMinute(null);
        }}
        categories={categories}
        availableEvents={availableEvents}
        selectedIds={selectedIds}
        onToggle={handleToggleEvent}
        onAddCustom={handleAddCustomEvent}
        isLoading={isLoadingLibrary}
        error={libraryError}
        totalCount={availableEvents.length}
        selectionMinute={pendingTimelineMinute}
      />

      {/* Success Modal */}
      {isSavedSuccess && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div className="modal-header-text">
                <h2>הסימולציה נשמרה בהצלחה</h2>
                <p>התרחיש המבצעי הוקם ומוכן להפעלה במערכת {SYSTEM_INFO[sys].name}</p>
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
                  background: 'var(--ok-soft)',
                  color: 'var(--ok)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--ok-line)'
                }}>
                  <CheckIcon size={20} />
                </span>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--ink)' }}>{simData.title}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
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
