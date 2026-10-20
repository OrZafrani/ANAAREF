import { useMemo, useState } from 'react';
import { PlusIcon } from '../Icons';
import { formatOffset, REPORT_KIND_LABELS } from '../../lib/aiSimulation';
import type { AiSimulationReport, ReportKind } from '../../types/aiSimulation';

interface Props {
  reports: AiSimulationReport[];
  busy: boolean;
  onEdit: (report: AiSimulationReport) => void;
  onRemove: (report: AiSimulationReport) => void;
  onLibrary: () => void;
  onRegenerate: () => void;
}

export const displayCasualty = (value: number | null) => value === null ? 'לא ידוע' : String(value);
const pageSize = 12;

export default function AiReportReview({ reports, busy, onEdit, onRemove, onLibrary, onRegenerate }: Props) {
  const [kind, setKind] = useState<ReportKind | 'all'>('all');
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => reports.filter((report) => kind === 'all' || report.kind === kind)
    .sort((a, b) => a.dispatch_offset_s - b.dispatch_offset_s), [reports, kind]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);

  return (
    <section aria-labelledby="ai-reports-heading">
      <header className="ai-section-heading">
        <div><h2 id="ai-reports-heading">דיווחים בסימולציה <span className="ai-count">{reports.length}</span></h2><p>דיווחי הדגמה סינתטיים, מסודרים לפי זמן ההזרמה.</p></div>
        <div className="ai-actions">
          <button type="button" className="ai-button" disabled={busy} onClick={onRegenerate}>יצירה מחדש</button>
          <button type="button" className="ai-button" disabled={busy} onClick={onLibrary}><PlusIcon size={16} />הוספה מהספרייה</button>
        </div>
      </header>
      <div className="ai-report-filters" role="group" aria-label="סינון לפי סוג דיווח">
        <button type="button" aria-pressed={kind === 'all'} onClick={() => { setKind('all'); setPage(1); }}>הכל ({reports.length})</button>
        {(['original', 'duplicate', 'false', 'noise'] as const).map((value) => (
          <button key={value} type="button" aria-pressed={kind === value} onClick={() => { setKind(value); setPage(1); }}>
            {REPORT_KIND_LABELS[value]} ({reports.filter((report) => report.kind === value).length})
          </button>
        ))}
      </div>
      {filtered.length === 0 && <div className="ai-panel ai-empty">אין דיווחים להצגה. אפשר להוסיף מהספרייה או ליצור מחדש.</div>}
      <div className="ai-report-grid">
        {filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((report) => (
          <article className="ai-panel ai-report-card" key={report.client_id}>
            <div className="ai-card-topline">
              <span className="ai-offset" dir="ltr">T+{formatOffset(report.dispatch_offset_s)}</span>
              <span className={`ai-kind ai-kind-${report.kind}`}>{REPORT_KIND_LABELS[report.kind]}</span>
              <span className="ai-muted">{report.origin === 'ai' ? 'AI · נתוני הדגמה' : 'עותק מהספרייה'}</span>
            </div>
            <h3>{report.payload.report_title || 'דיווח ללא כותרת'}</h3>
            <p className="ai-report-content">{report.payload.original_content}</p>
            <div className="ai-card-meta">
              <span>{report.payload.city || 'מיקום לא ידוע'}</span>
              <span>איום: {report.payload.threat_level ?? 'לא ידוע'}</span>
              <span>{report.payload.platform}</span>
            </div>
            <div className="ai-card-casualties">
              <span>כוחותינו: {displayCasualty(report.payload.blue_injured_count)} פצועים</span>
              <span>אויב: {displayCasualty(report.payload.red_injured_count)} פצועים</span>
            </div>
            <details className="ai-report-details">
              <summary>פרטי הדיווח</summary>
              <dl>
                <div><dt>כוחותינו — הרוגים</dt><dd>{displayCasualty(report.payload.blue_death_count)}</dd></div>
                <div><dt>אויב — הרוגים</dt><dd>{displayCasualty(report.payload.red_death_count)}</dd></div>
                <div><dt>קואורדינטות</dt><dd>{report.payload.lat ?? 'לא ידוע'}, {report.payload.long ?? 'לא ידוע'}</dd></div>
                <div><dt>נאסף (UTC)</dt><dd dir="ltr">{report.payload.collected_at}</dd></div>
                <div><dt>מקור</dt><dd>{report.payload.is_official ? 'רשמי' : 'פתוח'}</dd></div>
                <div><dt>מילות מפתח</dt><dd>{report.payload.matches?.join(' · ') || 'לא ידוע'}</dd></div>
              </dl>
            </details>
            <footer className="ai-actions">
              <button type="button" className="ai-button" disabled={busy} onClick={() => onEdit(report)} aria-label={`עריכת דיווח: ${report.payload.report_title}`}>עריכה</button>
              <button type="button" className="ai-button ai-button-danger" disabled={busy} onClick={() => onRemove(report)} aria-label={`הסרת דיווח: ${report.payload.report_title}`}>הסרה</button>
            </footer>
          </article>
        ))}
      </div>
      {pages > 1 && <nav className="ai-pagination" aria-label="עמודי דיווחים">
        <button type="button" className="ai-button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>לעמוד הקודם</button>
        <span aria-live="polite">עמוד {currentPage} מתוך {pages}</span>
        <button type="button" className="ai-button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>לעמוד הבא</button>
      </nav>}
    </section>
  );
}
