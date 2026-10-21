import { useMemo, useState } from 'react';
import { ClockIcon, PencilIcon, PinIcon, PlusIcon } from '../Icons';
import { aiReportTitle, DIFFICULTY_PRESETS, formatOffset, REPORT_KIND_LABELS } from '../../lib/aiSimulation';
import { getUrgency } from '../../lib/urgency';
import AiReportDetails from './AiReportDetails';
import AiReportEditor from './AiReportEditor';
import type { AiSimulationDraft, AiSimulationReport, ReportKind, ReportPayload } from '../../types/aiSimulation';
import type { SimulationEvent } from '../../types/simulation';

interface AiProps {
  reports: AiSimulationReport[];
  busy: boolean;
  onEdit: (report: AiSimulationReport) => void;
  onRemove: (report: AiSimulationReport) => void;
  onLibrary: () => void;
  onRegenerate: () => void;
  simulation: AiSimulationDraft['simulation'];
  generation: AiSimulationDraft['generation'];
  onSettings: () => void;
  onReorder: (sourceId: string, targetId: string) => void;
}

interface ManualProps {
  manualEvents: SimulationEvent[];
  duration: number;
  difficulty: string;
  activeEventId: string | null;
  onUpdate: (id: string, changes: Pick<SimulationEvent, 'title' | 'description' | 'city' | 'threatLevel' | 'minute'>) => void;
  onRemove: (id: string) => void;
  onLibrary: () => void;
  onReorder: (sourceId: string, targetId: string) => void;
}

type Props = AiProps | ManualProps;

export const displayCasualty = (value: number | null) => value === null ? 'לא ידוע' : String(value);
const pageSize = 12;

function manualEventToReport(event: SimulationEvent): AiSimulationReport {
  const payload: ReportPayload = {
    schema_version: 2,
    is_official: false,
    platform: 'manual',
    account_name: null,
    channel_name: null,
    report_url: event.reportUrl ?? '',
    report_title: event.title,
    original_language: null,
    published_at: null,
    happened_at: null,
    collected_at: new Date(0).toISOString(),
    original_content: event.description,
    translated_content: null,
    threat_level: event.threatLevel ?? null,
    country: event.country ?? null,
    city: event.city ?? null,
    lat: null,
    long: null,
    red_injured_count: null,
    red_death_count: null,
    blue_injured_count: null,
    blue_death_count: null,
    fastbreak_model_version: null,
    reality_id: 1,
  };
  return {
    client_id: event.id,
    template_id: null,
    payload,
    dispatch_offset_s: event.minute * 60,
    kind: 'unclassified',
    origin: event.reportUrl ? 'library' : 'ai',
    category_name: event.categoryName ?? event.category,
  };
}

function casualtySummary(deaths: number | null, injured: number | null) {
  if (deaths === null && injured === null) return 'לא ידוע';
  return `הרוגים: ${displayCasualty(deaths)} · פצועים: ${displayCasualty(injured)}`;
}

interface AiReportCardProps {
  report: AiSimulationReport;
  title?: string;
  busy: boolean;
  index: number;
  count: number;
  active?: boolean;
  canReorder: boolean;
  draggedId: string | null;
  dropId: string | null;
  onMove: (sourceId: string, targetId: string) => void;
  onMoveAdjacent: (id: string, direction: -1 | 1) => void;
  onStartDrag: (id: string) => void;
  onEndDrag: () => void;
  onDropTarget: (id: string | null) => void;
  onEdit: () => void;
  onDetails: () => void;
  onRemove: () => void;
}

function AiReportCard({
  report, title: titleOverride, busy, index, count, active = false, canReorder, draggedId, dropId,
  onMove, onMoveAdjacent, onStartDrag, onEndDrag, onDropTarget, onEdit, onDetails, onRemove,
}: AiReportCardProps) {
  const urgency = getUrgency(report.payload.threat_level);
  const title = titleOverride ?? aiReportTitle(report);

  return (
    <article
      className={`ai-panel ai-report-card${active ? ' ai-report-active' : ''}${draggedId === report.client_id ? ' ai-report-dragging' : ''}${dropId === report.client_id ? ' ai-report-drop-target' : ''}`}
      id={`selected-event-${report.client_id}`}
      onDragOver={(event) => {
        if (!canReorder || !draggedId || draggedId === report.client_id) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        onDropTarget(report.client_id);
      }}
      onDragLeave={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) onDropTarget(null);
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (draggedId) onMove(draggedId, report.client_id);
        onEndDrag();
        onDropTarget(null);
      }}
    >
      <div className="ai-card-topline">
        <span className="ai-report-tag">דיווח</span>
        <span className={`ai-kind ai-kind-${report.kind}`}>{REPORT_KIND_LABELS[report.kind]}</span>
        {report.origin === 'library' && <span className="ai-report-tag">עותק מהספרייה</span>}
        <div className="ai-report-order" role="group" aria-label="עיתוי וסדר הדיווח" title="גרירה משנה את עיתוי הדיווח בסימולציה">
          <div className="ai-report-timing" title="עיתוי ההזרמה קובע את סדר הדיווחים ברשימה">
            <ClockIcon size={14} />
            <span className="ai-offset" dir="ltr">T+{formatOffset(report.dispatch_offset_s)}</span>
          </div>
          <div className="ai-reorder-controls">
            <button type="button" className="ai-report-text-action ai-drag-handle" draggable={canReorder} disabled={!canReorder}
              aria-label={`הזזת דיווח: ${title}`} title="גרירה לשינוי סדר"
              onDragStart={(event) => {
                if (!canReorder) { event.preventDefault(); return; }
                event.dataTransfer.setData('text/plain', report.client_id);
                event.dataTransfer.effectAllowed = 'move';
                onStartDrag(report.client_id);
              }}
              onDragEnd={onEndDrag}
            ><span aria-hidden="true">⠿</span></button>
            <button type="button" className="ai-report-text-action" disabled={!canReorder || index === 0}
              aria-label={`העברה למעלה: ${title}`} onClick={() => onMoveAdjacent(report.client_id, -1)}><span aria-hidden="true">↑</span></button>
            <button type="button" className="ai-report-text-action" disabled={!canReorder || index === count - 1}
              aria-label={`העברה למטה: ${title}`} onClick={() => onMoveAdjacent(report.client_id, 1)}><span aria-hidden="true">↓</span></button>
          </div>
        </div>
      </div>
      <h3>{title}</h3>
      <p className="ai-report-content">{report.payload.original_content}</p>
      <div className="ai-card-meta">
        <span className="ai-report-location"><PinIcon size={14} />{report.payload.city || 'מיקום לא ידוע'}</span>
        <span className={`ai-report-urgency ai-urgency-${urgency.level}`}>דחיפות: {urgency.label}</span>
        <span className="ai-report-casualty ai-report-blue"><i aria-hidden="true" /><strong>כוחותינו:</strong> {casualtySummary(report.payload.blue_death_count, report.payload.blue_injured_count)}</span>
        <span className="ai-report-casualty ai-report-red"><i aria-hidden="true" /><strong>אויב:</strong> {casualtySummary(report.payload.red_death_count, report.payload.red_injured_count)}</span>
      </div>
      <footer className="ai-actions ai-report-actions">
        <button type="button" className="ai-button" disabled={busy} onClick={onEdit} aria-label={`עריכת דיווח: ${title}`}><PencilIcon size={14} />עריכה</button>
        <button type="button" className="ai-report-text-action" disabled={busy} onClick={onDetails} aria-label={`פרטים: ${title}`}>פרטים</button>
        <button type="button" className="ai-report-text-action" disabled={busy} onClick={onRemove} aria-label={`הסרת דיווח: ${title}`}>הסרה</button>
      </footer>
    </article>
  );
}

export default function AiReportReview(props: Props) {
  const [kind, setKind] = useState<ReportKind | 'all'>('all');
  const [page, setPage] = useState(1);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [manualDetailsEvent, setManualDetailsEvent] = useState<SimulationEvent | null>(null);
  const [manualEditingEvent, setManualEditingEvent] = useState<SimulationEvent | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [moveNotice, setMoveNotice] = useState('');
  const isManual = 'manualEvents' in props;
  const reports = isManual ? [] : props.reports;
  const busy = isManual ? false : props.busy;
  const canReorder = isManual || kind === 'all' ? !busy : false;
  const detailsReport = reports.find((report) => report.client_id === detailsId);
  const filtered = useMemo(() => reports.filter((report) => kind === 'all' || report.kind === kind)
    .sort((a, b) => a.dispatch_offset_s - b.dispatch_offset_s), [reports, kind]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const move = (sourceId: string, targetId: string) => {
    if (!canReorder || sourceId === targetId) return;
    props.onReorder(sourceId, targetId);
    setMoveNotice('סדר הדיווחים עודכן. הדיווחים הועברו בין זמני ההזרמה הקיימים.');
  };
  const moveCardAdjacent = (id: string, direction: -1 | 1) => {
    const sourceIndex = filtered.findIndex((report) => report.client_id === id);
    const target = filtered[sourceIndex + direction];
    if (sourceIndex >= 0 && target) move(id, target.client_id);
    if (target) setPage(Math.floor((sourceIndex + direction) / pageSize) + 1);
  };

  if (isManual) {
    const orderedEvents = [...props.manualEvents].sort((a, b) => a.minute - b.minute);
    const manualReports = orderedEvents.map(manualEventToReport);
    const filteredManualReports = manualReports.filter((report) => kind === 'all' || report.kind === kind);
    const manualPages = Math.max(1, Math.ceil(filteredManualReports.length / pageSize));
    const manualPage = Math.min(page, manualPages);
    const visibleReports = filteredManualReports.slice((manualPage - 1) * pageSize, manualPage * pageSize);
    const canReorderManual = kind === 'all';
    const moveManual = (sourceId: string, targetId: string) => {
      if (!canReorderManual) return;
      const reports = manualReports;
      const sourceIndex = reports.findIndex((report) => report.client_id === sourceId);
      const targetIndex = targetId === 'previous' ? sourceIndex - 1
        : targetId === 'next' ? sourceIndex + 1
          : reports.findIndex((report) => report.client_id === targetId);
      const target = reports[targetIndex];
      if (sourceIndex < 0 || !target || sourceId === target.client_id) return;
      props.onReorder(sourceId, target.client_id);
      setMoveNotice('סדר האירועים עודכן. האירועים הועברו בין זמני הסימולציה הקיימים.');
    };

    return (
      <section className="ai-builder ai-reports-panel" aria-labelledby="manual-reports-heading">
        <header className="ai-section-heading">
          <h2 id="manual-reports-heading">דיווחים בסימולציה <span className="ai-count">{orderedEvents.length}</span></h2>
          <div className="ai-actions">
            <button type="button" className="ai-button ai-library-action" onClick={props.onLibrary}>
              <PlusIcon size={16} />הוספה מהספרייה
            </button>
          </div>
        </header>
        <div className="ai-reports-summary">
          <span className="ai-kind">{props.difficulty}</span>
          <span>{orderedEvents.length} דיווחים · {props.duration} דק׳</span>
        </div>
        <div className="ai-report-filters" role="group" aria-label="סינון לפי סוג דיווח">
          <button type="button" aria-pressed={kind === 'all'} onClick={() => { setKind('all'); setPage(1); }}>
            הכל ({orderedEvents.length})
          </button>
          {orderedEvents.length > 0 && (
            <button type="button" aria-pressed={kind === 'unclassified'} onClick={() => { setKind('unclassified'); setPage(1); }}>
              {REPORT_KIND_LABELS.unclassified} ({orderedEvents.length})
            </button>
          )}
        </div>
        <p className="ai-reorder-hint">{canReorderManual
          ? 'גררו באמצעות ידית ההזזה, או השתמשו בחצים לשינוי הסדר. זמני האירועים נשארים במקומם.'
          : 'לשינוי סדר האירועים, בחרו בסינון ״הכל״.'}</p>
        <div className="ai-sr-only" role="status" aria-live="polite">{moveNotice}</div>
        {filteredManualReports.length === 0 && <div className="ai-panel ai-empty">
          {orderedEvents.length === 0 ? 'עדיין לא נוסף תוכן' : 'אין דיווחים להצגה.'}
        </div>}
        <div className="ai-report-grid" role="list" aria-label="דיווחים שנבחרו לסימולציה">
          {visibleReports.map((report, visibleIndex) => {
            const index = (manualPage - 1) * pageSize + visibleIndex;
            const event = orderedEvents[index];
            return (
              <AiReportCard
                key={report.client_id}
                report={report}
                title={event.title || 'דיווח ללא כותרת'}
                busy={false}
                index={index}
                count={filteredManualReports.length}
                active={props.activeEventId === event.id}
                canReorder={canReorderManual}
                draggedId={draggedId}
                dropId={dropId}
                onMove={moveManual}
                onMoveAdjacent={(id, direction) => {
                  const sourceIndex = manualReports.findIndex((item) => item.client_id === id);
                  const target = manualReports[sourceIndex + direction];
                  if (sourceIndex >= 0 && target) moveManual(id, target.client_id);
                }}
                onStartDrag={(id) => { setDraggedId(id); setMoveNotice(''); }}
                onEndDrag={() => { setDraggedId(null); setDropId(null); }}
                onDropTarget={setDropId}
                onEdit={() => setManualEditingEvent(event)}
                onDetails={() => setManualDetailsEvent(event)}
                onRemove={() => props.onRemove(event.id)}
              />
            );
          })}
        </div>
        {manualPages > 1 && <nav className="ai-pagination" aria-label="עמודי דיווחים">
          <button type="button" className="ai-button" disabled={manualPage === 1} onClick={() => setPage(manualPage - 1)}>לעמוד הקודם</button>
          <span aria-live="polite">עמוד {manualPage} מתוך {manualPages}</span>
          <button type="button" className="ai-button" disabled={manualPage === manualPages} onClick={() => setPage(manualPage + 1)}>לעמוד הבא</button>
        </nav>}
        {manualDetailsEvent && <AiReportDetails
          report={manualEventToReport(manualDetailsEvent)}
          busy={false}
          onClose={() => setManualDetailsEvent(null)}
          onEdit={() => {
            setManualEditingEvent(manualDetailsEvent);
            setManualDetailsEvent(null);
          }}
          onRemove={() => {
            props.onRemove(manualDetailsEvent.id);
            setManualDetailsEvent(null);
          }}
        />}
        {manualEditingEvent && <AiReportEditor
          report={manualEventToReport(manualEditingEvent)}
          durationSeconds={props.duration * 60}
          onClose={() => setManualEditingEvent(null)}
          onSave={(report) => {
            props.onUpdate(manualEditingEvent.id, {
              title: report.payload.report_title || 'דיווח ללא כותרת',
              description: report.payload.original_content,
              city: report.payload.city,
              threatLevel: report.payload.threat_level,
              minute: Math.round(report.dispatch_offset_s / 60),
            });
            setManualEditingEvent(null);
          }}
        />}
      </section>
    );
  }

  const { onEdit, onRemove, onLibrary, onRegenerate, simulation, generation, onSettings } = props;

  return (
    <section className="ai-reports-panel" aria-labelledby="ai-reports-heading">
      <header className="ai-section-heading">
        <h2 id="ai-reports-heading">דיווחים בסימולציה <span className="ai-count">{reports.length}</span></h2>
        <div className="ai-actions">
          <button type="button" className="ai-report-text-action" disabled={busy} onClick={onRegenerate}>תיאור חדש ויצירה מחדש</button>
          <button type="button" className="ai-button ai-library-action" disabled={busy} onClick={onLibrary}><PlusIcon size={16} />הוספה מהספרייה</button>
        </div>
      </header>
      <div className="ai-reports-summary">
        <span className="ai-kind">{DIFFICULTY_PRESETS[simulation.difficulty].label}</span>
        <span>{reports.length} דיווחים · {simulation.length_s / 60} דק׳ · {generation.reports_per_minute} לדק׳</span>
        <button type="button" className="ai-report-text-action" disabled={busy} onClick={onSettings}>עריכת ההגדרות</button>
      </div>
      <div className="ai-report-filters" role="group" aria-label="סינון לפי סוג דיווח">
        <button type="button" aria-pressed={kind === 'all'} onClick={() => { setKind('all'); setPage(1); }}>הכל ({reports.length})</button>
        {(['unclassified', 'original', 'duplicate', 'false', 'noise'] as const).filter((value) => reports.some((report) => report.kind === value)).map((value) => (
          <button key={value} type="button" aria-pressed={kind === value} onClick={() => { setKind(value); setPage(1); }}>
            {REPORT_KIND_LABELS[value]} ({reports.filter((report) => report.kind === value).length})
          </button>
        ))}
      </div>
      <p className="ai-reorder-hint">{kind === 'all' ? 'גררו באמצעות ידית ההזזה, או השתמשו בחצים לשינוי הסדר. זמני ההזרמה נשארים במקומם.' : 'לשינוי סדר הדיווחים, בחרו בסינון ״הכל״.'}</p>
      <div className="ai-sr-only" role="status">{moveNotice}</div>
      {filtered.length === 0 && <div className="ai-panel ai-empty">אין דיווחים להצגה. אפשר להוסיף מהספרייה או ליצור מחדש.</div>}
      <div className="ai-report-grid">
        {filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((report, visibleIndex) => {
          const index = (currentPage - 1) * pageSize + visibleIndex;
          return (
            <AiReportCard
              key={report.client_id}
              report={report}
              busy={busy}
              index={index}
              count={filtered.length}
              canReorder={canReorder}
              draggedId={draggedId}
              dropId={dropId}
              onMove={move}
              onMoveAdjacent={moveCardAdjacent}
              onStartDrag={(id) => { setDraggedId(id); setMoveNotice(''); }}
              onEndDrag={() => { setDraggedId(null); setDropId(null); }}
              onDropTarget={setDropId}
              onEdit={() => onEdit(report)}
              onDetails={() => setDetailsId(report.client_id)}
              onRemove={() => onRemove(report)}
            />
          );
        })}
      </div>
      {pages > 1 && <nav className="ai-pagination" aria-label="עמודי דיווחים">
        <button type="button" className="ai-button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>לעמוד הקודם</button>
        <span aria-live="polite">עמוד {currentPage} מתוך {pages}</span>
        <button type="button" className="ai-button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>לעמוד הבא</button>
      </nav>}
      {detailsReport && <AiReportDetails report={detailsReport} busy={busy} onClose={() => setDetailsId(null)} onEdit={() => { setDetailsId(null); onEdit(detailsReport); }} onRemove={() => { setDetailsId(null); onRemove(detailsReport); }} />}
    </section>
  );
}
