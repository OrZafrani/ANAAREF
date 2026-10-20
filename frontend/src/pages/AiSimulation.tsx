import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import BuilderHeader from '../components/BuilderHeader';
import ContentLibraryModal from '../components/ContentLibraryModal';
import AiScenarioSetup from '../components/ai/AiScenarioSetup';
import AiReportReview from '../components/ai/AiReportReview';
import AiReportEditor from '../components/ai/AiReportEditor';
import { AiIcon, ArrowLeftIcon, ArrowRightIcon, CheckIcon } from '../components/Icons';
import {
  aiReportTitle, aiSimulationService, createAiDraft, DIFFICULTY_PRESETS, formatOffset, generationFingerprint,
  REPORT_KIND_LABELS, reorderAiReports, templateToAiReport, validateAiReports, validateAiSettings,
} from '../lib/aiSimulation';
import { loadAiSimulations, saveAiSimulation } from '../lib/aiSimulationStorage';
import type { CategoryNode, LibraryTemplate } from '../lib/libraryApi';
import type { AiSimulationDraft, AiSimulationReport, BuilderStep } from '../types/aiSimulation';
import type { SimulationEvent } from '../types/simulation';
import './SelectEvents.css';
import './AiSimulation.css';

function loadDraft(id: string | null): { draft: AiSimulationDraft | null; error: string } {
  try {
    if (!id) return { draft: createAiDraft(), error: '' };
    const draft = loadAiSimulations().find((item) => item.simulation.id === id);
    if (!draft) throw new Error('הסימולציה המקומית לא נמצאה. ייתכן שנמחקה או נשמרה בדפדפן אחר.');
    return { draft, error: '' };
  } catch (error) {
    return { draft: null, error: `טעינת סימולציית ה-AI נכשלה: ${error instanceof Error ? error.message : 'שגיאה לא צפויה'}` };
  }
}

export default function AiSimulation() {
  const [params] = useSearchParams();
  const location = useLocation();
  const id = params.get('id');
  return <AiSimulationWorkspace key={id ?? location.key} draftId={id} />;
}

function AiSimulationWorkspace({ draftId }: { draftId: string | null }) {
  const [, setParams] = useSearchParams();
  const [initial] = useState(() => loadDraft(draftId));
  const [draft, setDraft] = useState(initial.draft);
  const [error, setError] = useState(initial.error);
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<'chat' | 'generation' | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [library, setLibrary] = useState<{ categories: CategoryNode[]; templates: LibraryTemplate[] }>({ categories: [], templates: [] });
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [editing, setEditing] = useState<AiSimulationReport | null>(null);
  const [confirmRegeneration, setConfirmRegeneration] = useState(false);
  const mounted = useRef(true);
  const busyRef = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const preventUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [dirty]);
  useEffect(() => {
    contentRef.current?.scrollIntoView?.({ block: 'start' });
  }, [draft?.step, error, confirmRegeneration]);
  useEffect(() => {
    if (!libraryOpen) return;
    let active = true;
    setLibraryLoading(true);
    setLibraryError('');
    aiSimulationService.loadLibrary()
      .then((result) => { if (active) setLibrary(result); })
      .catch((loadError: unknown) => {
        if (active) setLibraryError(loadError instanceof Error ? loadError.message : 'טעינת ספריית התוכן נכשלה');
      })
      .finally(() => { if (active) setLibraryLoading(false); });
    return () => { active = false; };
  }, [libraryOpen]);

  const update = (next: AiSimulationDraft) => {
    setDraft({ ...next, status: 'draft' });
    setDirty(true);
    setNotice('');
    setError('');
  };

  const send = async (message: string) => {
    if (!draft || busyRef.current) return false;
    busyRef.current = true;
    setBusy('chat');
    setError('');
    try {
      const next = await aiSimulationService.replyToScenario(draft, message);
      if (mounted.current) update(next);
      return true;
    } catch (replyError) {
      if (mounted.current) setError(`שליחת ההודעה נכשלה: ${replyError instanceof Error ? replyError.message : 'שגיאה לא צפויה'}`);
      return false;
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(null);
    }
  };

  const generate = async () => {
    if (!draft || busyRef.current) return;
    busyRef.current = true;
    setConfirmRegeneration(false);
    setBusy('generation');
    setError('');
    try {
      const reports = await aiSimulationService.generateReports(draft);
      if (mounted.current) update({ ...draft, reports, step: 2, generated_from: generationFingerprint(draft) });
    } catch (generationError) {
      if (mounted.current) setError(`יצירת הדיווחים נכשלה: ${generationError instanceof Error ? generationError.message : 'שגיאה לא צפויה'}`);
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(null);
    }
  };

  const requestGeneration = () => {
    if (!draft) return;
    const errors = validateAiSettings(draft);
    if (errors.length) { setError(errors.join(' ')); return; }
    if (draft.reports.length > 0) setConfirmRegeneration(true);
    else void generate();
  };

  if (!draft) return (
    <section className="ai-builder ai-main" dir="rtl">
      <p className="ai-alert" role="alert">{error}</p>
      <Link to="/simulations/ai" className="ai-button">פתיחת בונה AI חדש</Link>
      <Link to="/" className="ai-button">חזרה ללוח הבקרה</Link>
    </section>
  );

  const stale = draft.generated_from !== null && draft.generated_from !== generationFingerprint(draft);
  const goTo = (step: BuilderStep) => {
    setError('');
    if (step > 1) {
      const errors = [...validateAiSettings(draft), ...validateAiReports(draft)];
      if (stale) errors.push('התרחיש או הגדרות ההזרמה השתנו. יש ליצור מחדש את הדיווחים לפני ההמשך.');
      if (errors.length) { setError(errors.join(' ')); return; }
    }
    setDraft({ ...draft, step });
  };
  const save = (status: 'draft' | 'saved') => {
    setError('');
    if (status === 'saved') {
      const errors = [...validateAiSettings(draft), ...validateAiReports(draft)];
      if (stale) errors.push('יש ליצור מחדש את הדיווחים בעקבות שינוי ההגדרות.');
      if (errors.length) { setError(errors.join(' ')); return; }
    }
    try {
      const saved = saveAiSimulation(draft, status);
      setDraft(saved);
      setDirty(false);
      setNotice(status === 'saved' ? 'הסימולציה נשמרה מקומית. אפשר למצוא אותה בלוח הבקרה.' : 'הטיוטה נשמרה מקומית, כולל השיחה והעריכות.');
      if (!draftId) setParams({ id: saved.simulation.id }, { replace: true });
    } catch (saveError) {
      setError(`השמירה המקומית נכשלה: ${saveError instanceof Error ? saveError.message : 'בדקו את הרשאות האחסון בדפדפן.'}`);
    }
  };
  const toggleTemplate = (template: LibraryTemplate, minute: number) => {
    const selected = draft.reports.some((report) => report.template_id === template.id);
    update({
      ...draft,
      reports: selected ? draft.reports.filter((report) => report.template_id !== template.id) : [...draft.reports, templateToAiReport(template, minute)],
    });
  };
  const selectedLibraryIds = new Set(draft.reports.filter((report) => report.template_id !== null).map((report) => `library-${report.template_id}`));
  const libraryEvents: SimulationEvent[] = library.templates.map((template) => ({
    id: `library-${template.id}`,
    title: template.report_title || 'דיווח ללא כותרת',
    description: template.original_content,
    category: template.category_name ?? 'ספריית תוכן',
    categoryName: template.category_name,
    categoryId: template.category_id,
    subCategory: template.sub_category_name ?? undefined,
    subCategoryId: template.sub_category_id,
    city: template.city,
    country: template.country,
    threatLevel: template.threat_level,
    minute: 1,
  }));

  return (
    <div className="ai-builder" dir="rtl">
      <BuilderHeader
        title={draft.simulation.name}
        currentStep={draft.step}
        breadcrumb="בונה AI · סימולציה חדשה"
        stepLabels={['תרחיש בשיחה', 'בדיקה ועריכה', 'שמירה']}
        availableStep={draft.reports.length && !stale ? 3 : 1}
        disabled={busy !== null}
        isSaved={!dirty && draftId !== null}
        statusText={dirty ? 'שינויים שלא נשמרו' : draftId ? 'נשמר מקומית' : 'טרם נשמר'}
        onSave={() => save('saved')}
        onSaveDraft={() => save('draft')}
        onStepClick={goTo}
      />
      <div className="ai-main" ref={contentRef}>
        <aside className="ai-demo-notice"><AiIcon size={18} /><div><strong>מצב הדגמה · Frontend בלבד</strong><p>השיחה, הדיווחים והספרייה במסך זה מדומים. המידע נשמר בדפדפן בלבד; אין פנייה ל-AI, שמירה בשרת או הרצת סימולציה.</p></div></aside>
        {error && <div className="ai-alert" role="alert">{error}</div>}
        {notice && <div className="ai-notice" role="status">{notice}</div>}
        {!dirty && draftId && <div className="ai-notice">{draft.status === 'saved' ? 'סימולציה שמורה' : 'טיוטה שמורה'} · עדכון אחרון: {new Date(draft.updated_at).toLocaleString('he-IL')} · <Link to="/">ללוח הבקרה</Link></div>}
        {stale && <div className="ai-warning" role="status">ההגדרות השתנו מאז היצירה האחרונה. העריכות נשמרו במסך; יצירה מחדש תחליף את הדיווחים.</div>}
        {confirmRegeneration && <div className="ai-warning ai-confirmation" role="alert">
          <p>יצירה מחדש תחליף את כל הדיווחים, כולל עריכות ועותקים שהוספתם מהספרייה. להמשיך?</p>
          <div className="ai-actions">
            <button type="button" className="ai-button ai-button-primary" onClick={() => void generate()}>החלפת הדיווחים</button>
            <button type="button" className="ai-button" onClick={() => setConfirmRegeneration(false)}>ביטול יצירה מחדש</button>
          </div>
        </div>}
        {busy === 'generation' ? (
          <div className="ai-panel ai-generating" role="status" aria-live="polite"><AiIcon size={32} /><h2>מרכיב דיווחי הדגמה…</h2><p>מכין את התוכן, המיקומים ואת רצף ההזרמה.</p></div>
        ) : draft.step === 1 ? (
          <AiScenarioSetup draft={draft} busy={busy !== null} onSend={send} onSettings={(simulation, generation) => update({ ...draft, simulation, generation })} onGenerate={requestGeneration} />
        ) : draft.step === 2 ? (
          <>
            <AiReportReview
              reports={draft.reports} busy={busy !== null} onEdit={setEditing}
              simulation={draft.simulation} generation={draft.generation} onSettings={() => goTo(1)}
              onReorder={(sourceId, targetId) => {
                try {
                  update({ ...draft, reports: reorderAiReports(draft.reports, sourceId, targetId) });
                } catch (reorderError) {
                  setError(`שינוי סדר הדיווחים נכשל: ${reorderError instanceof Error ? reorderError.message : 'שגיאה לא צפויה'}`);
                }
              }}
              onRemove={(report) => update({ ...draft, reports: draft.reports.filter((item) => item.client_id !== report.client_id) })}
              onLibrary={() => setLibraryOpen(true)} onRegenerate={requestGeneration}
            />
            <div className="ai-bottom-nav">
              <button type="button" className="ai-button" onClick={() => goTo(1)}><ArrowRightIcon size={16} />חזרה להגדרות</button>
              <button type="button" className="ai-button ai-button-primary" onClick={() => goTo(3)} disabled={draft.reports.length === 0 || stale}>המשך לשמירה<ArrowLeftIcon size={16} /></button>
            </div>
          </>
        ) : (
          <section className="ai-panel" aria-labelledby="ai-review-heading">
            <header className="ai-section-heading"><div><h2 id="ai-review-heading">סקירה ושמירה</h2><p>בדקו את פרטי התרגיל לפני השמירה המקומית.</p></div><button type="button" className="ai-button" onClick={() => goTo(1)}>עריכת הגדרות</button></header>
            <dl className="ai-review-settings">
              <div><dt>שם</dt><dd>{draft.simulation.name}</dd></div>
              <div><dt>תיאור</dt><dd>{draft.simulation.description}</dd></div>
              <div><dt>מערכת יעד</dt><dd>SPECTRE · מציאות מדומה {draft.simulation.reality_id}</dd></div>
              <div><dt>רמת קושי</dt><dd>{DIFFICULTY_PRESETS[draft.simulation.difficulty].label}</dd></div>
              <div><dt>משך וקצב</dt><dd>{draft.simulation.length_s / 60} דקות · {draft.generation.reports_per_minute} דיווחים לדקה</dd></div>
              <div><dt>אחוזי יצירה</dt><dd>כפולים {draft.generation.duplicate_percent}% · שגויים {draft.generation.false_percent}% · רעש {draft.generation.noise_percent}% (בעיגול למספרי דיווחים שלמים)</dd></div>
            </dl>
            <div className="ai-section-heading"><h3>תוכן · {draft.reports.length} דיווחים</h3><button type="button" className="ai-button" onClick={() => goTo(2)}>עריכת דיווחים</button></div>
            <p className="ai-muted">הוספה והסרה ידניות עשויות לשנות את הכמות ואת היחס בין סוגי הדיווחים.</p>
            <ol className="ai-review-timeline">
              {[...draft.reports].sort((a, b) => a.dispatch_offset_s - b.dispatch_offset_s).map((report) => (
                <li key={report.client_id}><span className="ai-offset" dir="ltr">T+{formatOffset(report.dispatch_offset_s)}</span><span className={`ai-kind ai-kind-${report.kind}`}>{REPORT_KIND_LABELS[report.kind]}</span><span>{aiReportTitle(report)}</span></li>
              ))}
            </ol>
            <footer className="ai-actions">
              <button type="button" className="ai-button ai-button-primary" onClick={() => save('saved')}><CheckIcon size={16} />שמירת הסימולציה</button>
              <button type="button" className="ai-button" onClick={() => save('draft')}>שמירה כטיוטה</button>
              <button type="button" className="ai-button" onClick={() => goTo(2)}>חזרה לבדיקה</button>
            </footer>
          </section>
        )}
      </div>
      <ContentLibraryModal
        isOpen={libraryOpen} onClose={() => setLibraryOpen(false)} selectedIds={selectedLibraryIds}
        categories={library.categories} availableEvents={libraryEvents}
        isLoading={libraryLoading} error={libraryError} totalCount={library.templates.length}
        allowCustom={false} maxMinute={draft.simulation.length_s / 60}
        onToggle={(event) => {
          const template = library.templates.find((item) => `library-${item.id}` === event.id);
          if (!template) { setError('הוספת דיווח נכשלה: יש לבחור תבנית מלאה מהספרייה.'); return; }
          toggleTemplate(template, event.minute);
        }}
        onAddCustom={() => setError('דיווחים מותאמים אינם זמינים בבונה AI. אפשר לערוך דיווח קיים.')}
      />
      {editing && <AiReportEditor report={editing} durationSeconds={draft.simulation.length_s} onClose={() => setEditing(null)} onSave={(report) => {
        update({ ...draft, reports: draft.reports.map((item) => item.client_id === report.client_id ? report : item) });
        setEditing(null);
      }} />}
    </div>
  );
}
