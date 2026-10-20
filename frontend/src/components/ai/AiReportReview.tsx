import { useMemo, useState } from 'react';
import { PencilIcon, PinIcon, PlusIcon } from '../Icons';
import { aiReportTitle, DIFFICULTY_PRESETS, formatOffset, REPORT_KIND_LABELS } from '../../lib/aiSimulation';
import { getUrgency } from '../../lib/urgency';
import AiReportDetails from './AiReportDetails';
import type { AiSimulationDraft, AiSimulationReport, ReportKind } from '../../types/aiSimulation';

interface Props {
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

export const displayCasualty = (value: number | null) => value === null ? 'לא ידוע' : String(value);
const pageSize = 12;

function casualtySummary(deaths: number | null, injured: number | null) {
  if (deaths === null && injured === null) return 'לא ידוע';
  return `הרוגים: ${displayCasualty(deaths)} · פצועים: ${displayCasualty(injured)}`;
}

export default function AiReportReview({ reports, busy, onEdit, onRemove, onLibrary, onRegenerate, simulation, generation, onSettings, onReorder }: Props) {
  const [kind, setKind] = useState<ReportKind | 'all'>('all');
  const [page, setPage] = useState(1);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [moveNotice, setMoveNotice] = useState('');
  const canReorder = !busy && kind === 'all';
  const detailsReport = reports.find((report) => report.client_id === detailsId);
  const filtered = useMemo(() => reports.filter((report) => kind === 'all' || report.kind === kind)
    .sort((a, b) => a.dispatch_offset_s - b.dispatch_offset_s), [reports, kind]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const move = (sourceId: string, targetId: string) => {
    if (!canReorder || sourceId === targetId) return;
    onReorder(sourceId, targetId);
    setMoveNotice('סדר הדיווחים עודכן. הדיווחים הועברו בין זמני ההזרמה הקיימים.');
  };
  const moveAdjacent = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    const target = filtered[targetIndex];
    if (!target) return;
    move(filtered[index].client_id, target.client_id);
    setPage(Math.floor(targetIndex / pageSize) + 1);
  };

  return (
    <section className="ai-reports-panel" aria-labelledby="ai-reports-heading">
      <header className="ai-section-heading">
        <h2 id="ai-reports-heading">דיווחים בסימולציה <span className="ai-count">{reports.length}</span></h2>
        <div className="ai-actions">
          <button type="button" className="ai-report-text-action" disabled={busy} onClick={onRegenerate}>יצירה מחדש</button>
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
        {(['original', 'duplicate', 'false', 'noise'] as const).map((value) => (
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
          const urgency = getUrgency(report.payload.threat_level);
          const title = aiReportTitle(report);
          const index = (currentPage - 1) * pageSize + visibleIndex;
          return (
          <article className={`ai-panel ai-report-card${draggedId === report.client_id ? ' ai-report-dragging' : ''}${dropId === report.client_id ? ' ai-report-drop-target' : ''}`} key={report.client_id}
            onDragOver={(event) => {
              if (!canReorder || !draggedId || draggedId === report.client_id) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setDropId(report.client_id);
            }}
            onDragLeave={(event) => {
              if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropId(null);
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (draggedId) move(draggedId, report.client_id);
              setDraggedId(null);
              setDropId(null);
            }}
          >
            <div className="ai-card-topline">
              <span className="ai-offset" dir="ltr">T+{formatOffset(report.dispatch_offset_s)}</span>
              <span className="ai-report-tag">דיווח</span>
              <span className={`ai-kind ai-kind-${report.kind}`}>{REPORT_KIND_LABELS[report.kind]}</span>
              <span className="ai-report-tag">{report.origin === 'ai' ? 'נוצר ע״י AI' : 'עותק מהספרייה'}</span>
              <div className="ai-reorder-controls">
                <button type="button" className="ai-report-text-action ai-drag-handle" draggable={canReorder} disabled={!canReorder}
                  aria-label={`הזזת דיווח: ${title}`} title="גרירה לשינוי סדר"
                  onDragStart={(event) => {
                    if (!canReorder) { event.preventDefault(); return; }
                    event.dataTransfer.setData('text/plain', report.client_id);
                    event.dataTransfer.effectAllowed = 'move';
                    setDraggedId(report.client_id);
                    setMoveNotice('');
                  }}
                  onDragEnd={() => { setDraggedId(null); setDropId(null); }}
                ><span aria-hidden="true">⠿</span></button>
                <button type="button" className="ai-report-text-action" disabled={!canReorder || index === 0} aria-label={`העברה למעלה: ${title}`} onClick={() => moveAdjacent(index, -1)}><span aria-hidden="true">↑</span></button>
                <button type="button" className="ai-report-text-action" disabled={!canReorder || index === filtered.length - 1} aria-label={`העברה למטה: ${title}`} onClick={() => moveAdjacent(index, 1)}><span aria-hidden="true">↓</span></button>
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
              <button type="button" className="ai-button" disabled={busy} onClick={() => onEdit(report)} aria-label={`עריכת דיווח: ${title}`}><PencilIcon size={14} />עריכה</button>
              <button type="button" className="ai-report-text-action" disabled={busy} onClick={() => setDetailsId(report.client_id)} aria-label={`פרטים: ${title}`}>פרטים</button>
              <button type="button" className="ai-report-text-action" disabled={busy} onClick={() => onRemove(report)} aria-label={`הסרת דיווח: ${title}`}>הסרה</button>
            </footer>
          </article>
        ); })}
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
