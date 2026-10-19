import React, { useEffect, useMemo, useState } from 'react';
import { EventCategory, SimulationEvent } from '../types/simulation';
import { CheckIcon, CloseIcon, PlusIcon, SearchIcon } from './Icons';

export const LIBRARY_CATEGORIES: ('הכל' | EventCategory)[] = [
  'הכל',
  'מבצעי',
  'התראה',
  'תקלה',
  'חירום',
  'תקשורת',
];

interface ContentLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableEvents: SimulationEvent[];
  selectedIds: Set<string>;
  onToggle: (event: SimulationEvent) => void;
  onAddCustom: (event: SimulationEvent) => void;
}

export default function ContentLibraryModal(props: ContentLibraryModalProps) {
  const { isOpen, onClose, availableEvents, selectedIds, onToggle, onAddCustom } = props;
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'הכל' | EventCategory>('הכל');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customCategory, setCustomCategory] = useState<EventCategory>('מבצעי');
  const [customMinute, setCustomMinute] = useState<number>(10);
  const [customDescription, setCustomDescription] = useState('');
  const [customError, setCustomError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const filtered = useMemo(() => {
    const q = search.trim();
    return availableEvents.filter((evt) => {
      if (category !== 'הכל' && evt.category !== category) return false;
      if (!q) return true;
      return evt.title.includes(q) || evt.description.includes(q) || evt.category.includes(q);
    });
  }, [availableEvents, search, category]);

  if (!isOpen) return null;

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) {
      setCustomError('נא להזין שם לאירוע');
      return;
    }
    onAddCustom({
      id: `custom-${Date.now()}`,
      title: customTitle.trim(),
      category: customCategory,
      minute: Number(customMinute) || 1,
      description: customDescription.trim() || 'אירוע מותאם אישית.',
    });
    setCustomTitle('');
    setCustomDescription('');
    setCustomMinute(10);
    setCustomError('');
    setShowCustomForm(false);
  };

  return (
    <div className="library-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="library-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="library-modal-header">
          <div className="library-modal-header-text">
            <h2>ספריית התוכן</h2>
            <p>בחר אירועים מהמאגר המבצעי לשיבוץ במהלך הסימולציה</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="סגור חלון">
            <CloseIcon size={16} />
          </button>
        </div>
        <div className="library-modal-toolbar">
          <div className="library-search-wrap">
            <SearchIcon size={16} />
            <input
              type="text"
              className="library-search-input"
              placeholder="חיפוש אירוע..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="filter-pills-row library-filter-pills">
            {LIBRARY_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`filter-pill ${category === cat ? 'active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div className="library-modal-body">
          {filtered.length === 0 ? (
            <div className="empty-selected-box">
              <p>לא נמצאו אירועים התואמים את החיפוש</p>
            </div>
          ) : (
            filtered.map((event) => {
              const selected = selectedIds.has(event.id);
              return (
                <div key={event.id} className={`catalog-event-box ${selected ? 'is-added' : ''}`}>
                  <div className="box-top-line">
                    <h4 className="box-title">{event.title}</h4>
                    <div className="box-tags">
                      <span className={`tag-cat tag-cat-${event.category}`}>{event.category}</span>
                      <span className="tag-minute">דקה {event.minute}</span>
                    </div>
                  </div>
                  <p className="box-desc">{event.description}</p>
                  <div className="box-actions">
                    <button
                      type="button"
                      className={`btn-add-event ${selected ? 'added' : ''}`}
                      onClick={() => onToggle(event)}
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
            })
          )}
          {!showCustomForm ? (
            <button type="button" className="btn-toggle-custom" onClick={() => setShowCustomForm(true)}>
              <PlusIcon size={16} />
              <span>הוסף אירוע מותאם אישית</span>
            </button>
          ) : (
            <form className="custom-event-card" onSubmit={handleSubmitCustom}>
              <h4 className="custom-form-title">הגדרת אירוע מותאם</h4>
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
              <div className="custom-form-2col">
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
              <div className="custom-form-actions">
                <button type="button" className="btn-bottom-prev" onClick={() => setShowCustomForm(false)}>
                  ביטול
                </button>
                <button type="submit" className="btn-bottom-next">
                  הוסף אירוע
                </button>
              </div>
            </form>
          )}
        </div>
        <div className="library-modal-footer">
          <span className="library-selected-count">{selectedIds.size} אירועים נבחרו</span>
          <button type="button" className="top-gold-btn" onClick={onClose}>
            סיום והמשך
          </button>
        </div>
      </div>
    </div>
  );
}
