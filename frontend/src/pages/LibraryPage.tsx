import { useDeferredValue, useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react';
import TemplateModal from '../components/library/TemplateModal';
import {
  createCategory,
  createSubCategory,
  createTemplate,
  deleteCategory,
  deleteSubCategory,
  deleteTemplate,
  getCategoryTree,
  getTemplates,
  renameCategory,
  renameSubCategory,
  updateTemplate,
  type CategoryNode,
  type LibraryTemplate,
  type TemplateWrite,
} from '../lib/libraryApi';
import './LibraryPage.css';

type Selection = { categoryId: string | null; subCategoryId: string | null };
type TemplateDialog = { mode: 'view' | 'edit' | 'create'; template: LibraryTemplate | null };
type CategoryDialog = {
  kind: 'category' | 'subcategory';
  action: 'create' | 'rename';
  id?: string;
  parentId?: string;
  name: string;
};
type ContextMenu = {
  x: number;
  y: number;
  kind: 'blank' | 'category' | 'subcategory';
  id?: string;
  parentId?: string;
};

const canWrite = import.meta.env.VITE_LIBRARY_WRITE_ENABLED !== 'false';
const contains = (value: string | null | undefined, query: string) =>
  (value ?? '').toLocaleLowerCase().includes(query.toLocaleLowerCase());

function threatClass(value: number | null) {
  return `threat-${Math.min(5, Math.max(1, Math.ceil((value ?? 0) / 20)))}`;
}

export default function LibraryPage() {
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [templates, setTemplates] = useState<LibraryTemplate[]>([]);
  const [selection, setSelection] = useState<Selection>({ categoryId: null, subCategoryId: null });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [templateDialog, setTemplateDialog] = useState<TemplateDialog | null>(null);
  const [categoryDialog, setCategoryDialog] = useState<CategoryDialog | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      getCategoryTree(),
      getTemplates({ search: deferredSearch || undefined }),
    ]).then(([tree, reports]) => {
      if (!active) return;
      setCategories(tree);
      setTemplates(reports);
      setError('');
    }).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'טעינת הספרייה נכשלה');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [deferredSearch, revision]);

  const selectedCategory = categories.find((category) => category.id === selection.categoryId);
  const selectedSubCategory = selectedCategory?.sub_categories.find((sub) => sub.id === selection.subCategoryId);
  const contextCategory = contextMenu?.kind === 'category'
    ? categories.find((category) => category.id === contextMenu.id)
    : undefined;
  const contextSubCategory = contextMenu?.kind === 'subcategory'
    ? categories.flatMap((category) => category.sub_categories).find((subcategory) => subcategory.id === contextMenu.id)
    : undefined;
  const contextDeleteDisabled = contextMenu?.kind === 'category'
    ? Boolean(contextCategory && (contextCategory.report_count > 0 || contextCategory.sub_categories.length > 0))
    : contextMenu?.kind === 'subcategory'
      ? Boolean(contextSubCategory && contextSubCategory.report_count > 0)
      : false;
  const visibleTemplates = useMemo(() => templates.filter((template) => {
    if (selection.categoryId && template.category_id !== selection.categoryId) return false;
    if (selection.subCategoryId && template.sub_category_id !== selection.subCategoryId) return false;
    return true;
  }), [templates, selection]);

  const templatesBySubCategory = useMemo(() => {
    const grouped = new Map<string, LibraryTemplate[]>();
    for (const template of templates) {
      if (!template.sub_category_id) continue;
      const items = grouped.get(template.sub_category_id) ?? [];
      items.push(template);
      grouped.set(template.sub_category_id, items);
    }
    return grouped;
  }, [templates]);

  const directTemplates = useMemo(() => {
    const grouped = new Map<string, LibraryTemplate[]>();
    for (const template of templates) {
      if (template.sub_category_id) continue;
      const items = grouped.get(template.category_id) ?? [];
      items.push(template);
      grouped.set(template.category_id, items);
    }
    return grouped;
  }, [templates]);

  const visibleCategories = useMemo(() => categories.filter((category) => {
    if (!deferredSearch || contains(category.name, deferredSearch)) return true;
    return category.sub_categories.some((subcategory) =>
      contains(subcategory.name, deferredSearch) || (templatesBySubCategory.get(subcategory.id)?.length ?? 0) > 0,
    ) || (directTemplates.get(category.id)?.length ?? 0) > 0;
  }), [categories, deferredSearch, directTemplates, templatesBySubCategory]);

  const refresh = () => setRevision((current) => current + 1);
  const chooseCategory = (categoryId: string | null) => setSelection({ categoryId, subCategoryId: null });
  const toggleCategory = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const showContextMenu = (event: MouseEvent, menu: Omit<ContextMenu, 'x' | 'y'>) => {
    if (!canWrite) return;
    event.preventDefault();
    setContextMenu({ ...menu, x: Math.min(event.clientX, window.innerWidth - 220), y: Math.min(event.clientY, window.innerHeight - 190) });
  };

  const openCategoryDialog = (dialog: CategoryDialog) => {
    setContextMenu(null);
    setCategoryDialog(dialog);
  };

  const saveCategoryDialog = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!categoryDialog) return;
    try {
      if (categoryDialog.kind === 'category') {
        if (categoryDialog.action === 'create') await createCategory(categoryDialog.name.trim());
        else if (categoryDialog.id) await renameCategory(categoryDialog.id, categoryDialog.name.trim());
      } else if (categoryDialog.action === 'create' && categoryDialog.parentId) {
        await createSubCategory(categoryDialog.parentId, categoryDialog.name.trim());
      } else if (categoryDialog.action === 'rename' && categoryDialog.id) {
        await renameSubCategory(categoryDialog.id, categoryDialog.name.trim(), categoryDialog.parentId);
      }
      setCategoryDialog(null);
      refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'שמירת הקטגוריה נכשלה');
    }
  };

  const handleContextAction = async (action: 'add-category' | 'add-subcategory' | 'rename' | 'delete') => {
    if (!contextMenu) return;
    const menu = contextMenu;
    setContextMenu(null);
    if (action === 'add-category') {
      openCategoryDialog({ kind: 'category', action: 'create', name: '' });
      return;
    }
    if (action === 'add-subcategory' && menu.id) {
      openCategoryDialog({ kind: 'subcategory', action: 'create', parentId: menu.id, name: '' });
      return;
    }
    if (action === 'rename' && menu.id) {
      const category = categories.find((item) => item.id === menu.id);
      const subcategory = categories.flatMap((item) => item.sub_categories).find((item) => item.id === menu.id);
      const isCategory = menu.kind === 'category';
      const parentCategory = isCategory ? undefined : categories.find((item) =>
        item.sub_categories.some((child) => child.id === menu.id),
      );
      openCategoryDialog({
        kind: isCategory ? 'category' : 'subcategory',
        action: 'rename',
        id: menu.id,
        parentId: parentCategory?.id,
        name: isCategory ? category?.name ?? '' : subcategory?.name ?? '',
      });
      return;
    }
    if (action === 'delete' && menu.id) {
      const label = menu.kind === 'category' ? 'הקטגוריה' : 'תת-הקטגוריה';
      if (!window.confirm(`למחוק את ${label}? מחיקה תיחסם אם יש בה תתי-קטגוריות או תבניות.`)) return;
      try {
        if (menu.kind === 'category') await deleteCategory(menu.id);
        else await deleteSubCategory(menu.id);
        if (selection.categoryId === menu.id || selection.subCategoryId === menu.id) chooseCategory(null);
        refresh();
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : 'המחיקה נכשלה');
      }
    }
  };

  const saveTemplate = async (value: TemplateWrite) => {
    if (templateDialog?.mode === 'edit' && templateDialog.template) {
      await updateTemplate(templateDialog.template.id, value);
    } else {
      await createTemplate(value);
    }
    setTemplateDialog(null);
    refresh();
  };

  const removeTemplate = async () => {
    const template = templateDialog?.template;
    if (!template || !window.confirm('למחוק את התבנית לצמיתות?')) return;
    try {
      await deleteTemplate(template.id);
      setTemplateDialog(null);
      refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'מחיקת התבנית נכשלה');
    }
  };

  return (
    <div className="library-shell" dir="rtl">
      {error && <div className="error-banner" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')}>סגירה</button></div>}

      <div className="library-workspace">
        <nav className="app-sidebar" aria-label="ניווט ראשי">
          <div className="sidebar-section-label">מרחב עבודה</div>
          <button className="app-nav-item" type="button" disabled>
            <span aria-hidden="true">▦</span>לוח בקרה
          </button>
          <button className="app-nav-item is-active" type="button" aria-current="page">
            <span aria-hidden="true">◇</span>ספריית תוכן
          </button>
        </nav>

        <aside className="tree-panel" onContextMenu={(event) => {
          const target = event.target as HTMLElement;
          if (!target.closest('.category-row, .subcategory-row, .tree-template')) {
            showContextMenu(event, { kind: 'blank' });
          }
        }}>
          <div className="tree-panel-heading">
            <h2>קטגוריות</h2>
            {canWrite && <button className="small-action" type="button" aria-label="הוספת קטגוריה" title="הוספת קטגוריה" onClick={() => openCategoryDialog({ kind: 'category', action: 'create', name: '' })}>＋</button>}
          </div>
          <label className="search-field category-search">
            <span className="search-glyph" aria-hidden="true">⌕</span>
            <input aria-label="חיפוש בקטגוריות ובתבניות" placeholder="חיפוש כותרת, תיאור או עיר" value={search} onChange={(event) => setSearch(event.target.value)} />
            {search && <button type="button" className="clear-search" aria-label="ניקוי חיפוש" onClick={() => setSearch('')}>×</button>}
          </label>
          <button className={`tree-row tree-all ${!selection.categoryId ? 'is-selected' : ''}`} type="button" onClick={() => chooseCategory(null)}>
            <span className="tree-folder-icon">▤</span><span>כל התבניות</span><span className="tree-count">{templates.length}</span>
          </button>
          {loading && categories.length === 0 ? <div className="tree-loading">טוען קטלוג...</div> : (
            <div className="category-tree">
              {visibleCategories.map((category) => {
                const categoryTemplates = directTemplates.get(category.id) ?? [];
                const expandedCategory = expanded.has(category.id);
                return (
                  <div className="tree-branch" key={category.id} onContextMenu={(event) => showContextMenu(event, { kind: 'category', id: category.id })}>
                    <div className={`tree-row category-row ${selection.categoryId === category.id && !selection.subCategoryId ? 'is-selected' : ''}`}>
                      <button className="tree-chevron" type="button" aria-label={expandedCategory ? 'כיווץ קטגוריה' : 'הרחבת קטגוריה'} onClick={() => toggleCategory(category.id)}>{expandedCategory ? '⌄' : '‹'}</button>
                      <button className="tree-label" type="button" onClick={() => chooseCategory(category.id)}><span className="tree-folder-icon">▱</span><span>{category.name}</span></button>
                      <span className="tree-count">{category.report_count}</span>
                    </div>
                    {expandedCategory && <div className="tree-children">
                      {category.sub_categories.filter((subcategory) => !deferredSearch || contains(subcategory.name, deferredSearch) || (templatesBySubCategory.get(subcategory.id)?.length ?? 0) > 0).map((subcategory) => {
                        const children = templatesBySubCategory.get(subcategory.id) ?? [];
                        return <div key={subcategory.id} className="tree-subbranch" onContextMenu={(event) => {
                          event.stopPropagation();
                          showContextMenu(event, { kind: 'subcategory', id: subcategory.id, parentId: category.id });
                        }}>
                          <div className={`tree-row subcategory-row ${selection.subCategoryId === subcategory.id ? 'is-selected' : ''}`}>
                            <button className="tree-label" type="button" onClick={() => setSelection({ categoryId: category.id, subCategoryId: subcategory.id })}><span className="tree-sub-icon">◦</span><span>{subcategory.name}</span></button>
                            <span className="tree-count">{subcategory.report_count}</span>
                          </div>
                          <div className="template-tree-children">
                            {children.map((template) => <button key={template.id} className="tree-template" type="button" title={template.report_title ?? template.report_url} onContextMenu={(event) => event.stopPropagation()} onClick={() => setTemplateDialog({ mode: 'view', template })}>
                              <span className="tree-file-icon">▧</span><span>{template.report_title || 'תבנית ללא כותרת'}</span>
                            </button>)}
                          </div>
                        </div>;
                      })}
                      {categoryTemplates.map((template) => <button key={template.id} className="tree-template root-template" type="button" title={template.report_title ?? template.report_url} onContextMenu={(event) => event.stopPropagation()} onClick={() => setTemplateDialog({ mode: 'view', template })}>
                        <span className="tree-file-icon">▧</span><span>{template.report_title || 'תבנית ללא כותרת'}</span>
                      </button>)}
                    </div>}
                  </div>
                );
              })}
              {categories.length === 0 && !loading && <p className="tree-empty">אין קטגוריות להצגה</p>}
            </div>
          )}
          <div className="tree-footer"><span className="status-dot" /> {categories.length} קטגוריות · {templates.length} תבניות</div>
        </aside>

        <main className="template-browser">
          <div className="browser-topbar">
            <span className="eyebrow">SPECTRE · ספריית תוכן</span>
            {canWrite && <button className="button button-primary new-template-button" type="button" onClick={() => setTemplateDialog({ mode: 'create', template: null })}>＋ תבנית חדשה</button>}
          </div>
          <div className="browser-heading">
            <div>
              <h1>דיווחים</h1>
              <p>תבניות SPECTRE לשימוש חוזר, כולל דוגמאות לדיווחים כפולים, שגויים ורעש רקע.</p>
            </div>
            <div className="browser-counts"><strong>{visibleTemplates.length} דיווחים</strong><span>{selectedSubCategory?.name ?? selectedCategory?.name ?? 'כל הקטגוריות'}</span></div>
          </div>
          {loading && templates.length === 0 ? <div className="loading-state"><span className="loading-mark" />טוען תבניות</div> : visibleTemplates.length === 0 ? (
            <div className="empty-state"><div className="empty-mark">⌕</div><h3>{search ? 'לא נמצאו תוצאות' : 'אין תבניות בתיקייה הזו'}</h3><p>{search ? 'נסו מונח חיפוש אחר או בדקו את האיות.' : 'בחירת קטגוריה אחרת תציג תבניות נוספות.'}</p></div>
          ) : (
            <div className="template-grid">
              {visibleTemplates.map((template, index) => <article className="template-card" key={template.id} style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }} onClick={() => setTemplateDialog({ mode: 'view', template })} onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setTemplateDialog({ mode: 'view', template });
                }
              }} tabIndex={0} role="button" aria-label={`צפייה בתבנית ${template.report_title ?? ''}`}>
                <div className="card-topline">
                  <div className="card-tags"><span className="platform-tag">דיווח</span><span className="source-tag">{template.is_official ? 'מקור' : 'פתוח'}</span>{(template.matches?.length ?? 0) > 0 && <span className="matches-tag">{template.matches?.length} ממצאים</span>}</div>
                  <span className="card-category-label">{template.sub_category_name ?? template.category_name}</span>
                </div>
                <h3>{template.report_title || 'תבנית ללא כותרת'}</h3>
                <p className="card-description">{template.original_content}</p>
                <div className="card-meta">
                  <span className="card-location"><span aria-hidden="true">⌖</span>{[template.city, template.country].filter(Boolean).join(' · ') || 'מיקום לא דווח'}</span>
                  <span className="card-time"><span aria-hidden="true">◷</span>{new Date(template.happened_at ?? template.collected_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className={`threat-tag ${threatClass(template.threat_level)}`}><i />{(template.threat_level ?? 0) >= 70 ? 'דחיפות גבוה' : (template.threat_level ?? 0) >= 40 ? 'דחיפות בינונית' : 'דחיפות נמוכה'}</span>
                </div>
                <div className="card-casualties">
                  <span><i className="blue-dot" />כוחותינו: {template.blue_injured_count ?? 'לא ידוע'}</span>
                  <span><i className="red-dot" />אויב: {template.red_injured_count ?? 'לא ידוע'}</span>
                </div>
                <footer className="card-footer">
                  {canWrite && <button className="card-edit" type="button" onClick={(event) => {
                    event.stopPropagation();
                    setTemplateDialog({ mode: 'edit', template });
                  }}>עריכה <span aria-hidden="true">✎</span></button>}
                </footer>
              </article>)}
            </div>
          )}
        </main>
      </div>

      {contextMenu && <>
        <button className="context-dismiss" aria-label="סגירת תפריט" type="button" onClick={() => setContextMenu(null)} />
        <div className="context-menu" role="menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          {contextMenu.kind === 'blank' ? <button type="button" role="menuitem" onClick={() => void handleContextAction('add-category')}>＋ יצירת קטגוריה</button> : <>
            {contextMenu.kind === 'category' && <button type="button" role="menuitem" onClick={() => void handleContextAction('add-subcategory')}>＋ הוספת תת-קטגוריה</button>}
            <button type="button" role="menuitem" onClick={() => void handleContextAction('rename')}>שינוי שם</button>
            <button className="menu-danger" type="button" role="menuitem" disabled={contextDeleteDisabled} title={contextDeleteDisabled ? 'ניתן למחוק רק תיקייה ריקה' : undefined} onClick={() => void handleContextAction('delete')}>מחיקה</button>
          </>}
        </div>
      </>}

      {categoryDialog && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setCategoryDialog(null);
      }}><section className="category-modal" role="dialog" aria-modal="true" aria-labelledby="category-dialog-title" dir="rtl">
        <span className="eyebrow">ניהול תיקיות</span>
        <h2 id="category-dialog-title">{categoryDialog.action === 'create' ? categoryDialog.kind === 'category' ? 'קטגוריה חדשה' : 'תת-קטגוריה חדשה' : 'שינוי שם'}</h2>
        <form onSubmit={(event) => void saveCategoryDialog(event)}>
          <label>{categoryDialog.kind === 'category' ? 'שם הקטגוריה' : 'שם תת-הקטגוריה'}<input autoFocus required maxLength={200} value={categoryDialog.name} onChange={(event) => setCategoryDialog({ ...categoryDialog, name: event.target.value })} /></label>
          {categoryDialog.kind === 'subcategory' && categoryDialog.action === 'rename' && <label>קטגוריית אב<select required value={categoryDialog.parentId ?? ''} onChange={(event) => setCategoryDialog({ ...categoryDialog, parentId: event.target.value })}>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select></label>}
          <div className="modal-actions"><button className="button button-primary" type="submit">שמירה</button><button className="button button-quiet" type="button" onClick={() => setCategoryDialog(null)}>ביטול</button></div>
        </form>
      </section></div>}

      {templateDialog && <TemplateModal
        mode={templateDialog.mode}
        template={templateDialog.template}
        categories={categories}
        canWrite={canWrite}
        initialCategoryId={selection.categoryId}
        initialSubCategoryId={selection.subCategoryId}
        onClose={() => setTemplateDialog(null)}
        onSave={saveTemplate}
        onEdit={() => setTemplateDialog((current) => current ? { ...current, mode: 'edit' } : current)}
        onDelete={removeTemplate}
      />}
    </div>
  );
}
