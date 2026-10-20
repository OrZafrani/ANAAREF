import React, { useEffect, useMemo, useState } from 'react';
import type { CategoryNode } from '../lib/libraryApi';
import { getUrgency } from '../lib/urgency';
import type { EventCategory, SimulationEvent } from '../types/simulation';
import { CloseIcon, PlusIcon, SearchIcon } from './Icons';

interface ContentLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryNode[];
  availableEvents: SimulationEvent[];
  selectedIds: Set<string>;
  onToggle: (event: SimulationEvent) => void;
  onAddCustom: (event: SimulationEvent) => void;
  isLoading: boolean;
  error: string;
  totalCount: number;
}

export default function ContentLibraryModal({
  isOpen,
  onClose,
  categories,
  availableEvents,
  selectedIds,
  onToggle,
  onAddCustom,
  isLoading,
  error,
  totalCount,
}: ContentLibraryModalProps) {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customCategory, setCustomCategory] = useState<EventCategory>('מבצעי');
  const [customMinute, setCustomMinute] = useState<number>(10);
  const [customDescription, setCustomDescription] = useState('');
  const [customError, setCustomError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return availableEvents.filter((event) => {
      if (categoryId && event.categoryId !== categoryId) return false;
      if (subCategoryId && event.subCategoryId !== subCategoryId) return false;
      if (!query) return true;
      return [
        event.title,
        event.description,
        event.categoryName,
        event.subCategory,
      ].some((value) => value?.toLocaleLowerCase().includes(query));
    });
  }, [availableEvents, search, categoryId, subCategoryId]);

  if (!isOpen) return null;

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const handleSelectCategory = (nextCategoryId: string | null) => {
    setCategoryId(nextCategoryId);
    setSubCategoryId(null);
  };

  const handleSubmitCustom = (event: React.FormEvent) => {
    event.preventDefault();
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
      <div className="library-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="library-modal-header">
          <div className="library-modal-header-text">
            <h2>ספריית התוכן</h2>
            <p>
              {typeof totalCount === 'number'
                ? `${totalCount} דיווחים מהמאגר (${filteredEvents.length} מוצגים)`
                : 'בחרו דיווח מהקטגוריות והתיקיות בספריית התוכן'}
            </p>
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
              placeholder="חיפוש דיווח, תיאור או מיקום..."
              aria-label="חיפוש בספריית הדיווחים"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <div className="library-modal-body">
          <nav className="library-category-tree" aria-label="קטגוריות בספרייה">
            <button
              type="button"
              className={`library-category-option ${!categoryId ? 'active' : ''}`}
              onClick={() => handleSelectCategory(null)}
            >
              <span>כל הדיווחים</span>
              <span className="tree-count">{availableEvents.length}</span>
            </button>
            {categories.map((category) => (
              <div className="library-category-branch" key={category.id}>
                <button
                  type="button"
                  className={`library-category-option ${categoryId === category.id && !subCategoryId ? 'active' : ''}`}
                  onClick={() => handleSelectCategory(category.id)}
                >
                  <span>{category.name}</span>
                  <span className="tree-count">{category.report_count}</span>
                </button>
                {category.sub_categories.map((subcategory) => (
                  <button
                    type="button"
                    className={`library-subcategory-option ${subCategoryId === subcategory.id ? 'active' : ''}`}
                    key={subcategory.id}
                    onClick={() => {
                      setCategoryId(category.id);
                      setSubCategoryId(subcategory.id);
                    }}
                  >
                    <span>{subcategory.name}</span>
                    <span className="tree-count">{subcategory.report_count}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="library-report-list">
            <div className="library-report-heading">
              <strong>{subCategoryId
                ? selectedCategory?.sub_categories.find((subcategory) => subcategory.id === subCategoryId)?.name
                : selectedCategory?.name ?? 'דיווחים'}
              </strong>
              <span>{filteredEvents.length} דיווחים</span>
            </div>
            {isLoading ? (
              <div className="empty-selected-box"><p>טוען דיווחים וקטגוריות...</p></div>
            ) : error ? (
              <div className="empty-selected-box" role="alert"><p>טעינת ספריית התוכן נכשלה: {error}</p></div>
            ) : filteredEvents.length === 0 ? (
              <div className="empty-selected-box"><p>לא נמצאו דיווחים בקטגוריה או בחיפוש הזה</p></div>
            ) : (
              filteredEvents.map((libraryEvent) => {
                const selected = selectedIds.has(libraryEvent.id);
                const simulationEvent = libraryEvent;
                const categoryLabel = [libraryEvent.categoryName, libraryEvent.subCategory]
                  .filter(Boolean)
                  .join(' · ') || libraryEvent.category;
                const urgency = getUrgency(libraryEvent.threatLevel);
                return (
                  <article
                    key={libraryEvent.id}
                    className={`catalog-event-box library-report-card ${selected ? 'is-added' : ''}`}
                    onClick={() => onToggle(simulationEvent)}
                  >
                    <div className="library-report-meta-top">
                      <label
                        className="library-report-select"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          aria-label={`${selected ? 'הסר מהסימולציה' : 'הוסף לסימולציה'}: ${libraryEvent.title || 'דיווח ללא כותרת'}`}
                          onChange={() => onToggle(simulationEvent)}
                        />
                      </label>
                      <span className="library-report-original">מקורי</span>
                      <span className="library-report-category">{categoryLabel}</span>
                    </div>
                    <h4 className="box-title library-report-card-title">{libraryEvent.title || 'דיווח ללא כותרת'}</h4>
                    <p className="box-desc">{libraryEvent.description}</p>
                    <div className="library-report-card-footer">
                      <span className="library-report-area">
                        <span aria-hidden="true">⌖</span>
                        {[libraryEvent.city, libraryEvent.country].filter(Boolean).join(' · ') || 'אזור לא דווח'}
                      </span>
                      <span className={`library-report-urgency ${urgency.level}`}>
                        דחיפות: {urgency.label}
                      </span>
                      <span className="library-report-minute">
                        דקה בסימולציה: {libraryEvent.minute}
                      </span>
                    </div>
                  </article>
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
                    onChange={(event) => setCustomTitle(event.target.value)}
                  />
                </div>
                <div className="custom-form-2col">
                  <div className="builder-form-group">
                    <label className="builder-label">סיווג</label>
                    <select
                      className="builder-input"
                      value={customCategory}
                      onChange={(event) => setCustomCategory(event.target.value)}
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
                      onChange={(event) => setCustomMinute(Number(event.target.value))}
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
                    onChange={(event) => setCustomDescription(event.target.value)}
                  />
                </div>
                <div className="custom-form-actions">
                  <button type="button" className="btn-bottom-prev" onClick={() => setShowCustomForm(false)}>ביטול</button>
                  <button type="submit" className="btn-bottom-next">הוסף אירוע</button>
                </div>
              </form>
            )}
          </div>
        </div>
        <div className="library-modal-footer">
          <span className="library-selected-count">{selectedIds.size} דיווחים נבחרו</span>
          <button type="button" className="top-gold-btn" onClick={onClose}>סיום והמשך</button>
        </div>
      </div>
    </div>
  );
}
