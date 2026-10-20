import { useEffect, useRef } from 'react';
import { CloseIcon, PencilIcon } from '../Icons';
import { aiReportTitle, formatOffset, REPORT_KIND_LABELS } from '../../lib/aiSimulation';
import { getUrgency } from '../../lib/urgency';
import type { AiSimulationReport } from '../../types/aiSimulation';
import '../SimulationDrawer.css';

interface Props {
  report: AiSimulationReport;
  busy: boolean;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

const unknown = 'לא ידוע';
const timestamp = (value: string | null) => value ? `${new Date(value).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')} UTC` : unknown;

export default function AiReportDetails({ report, busy, onClose, onEdit, onRemove }: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const payload = report.payload;
  const urgency = getUrgency(payload.threat_level);

  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  const mainFields = [
    ['מיקום', [payload.city, payload.country].filter(Boolean).join(' · ') || unknown],
    ['זמן התרחשות', timestamp(payload.happened_at)],
    ['זמן קליטה', timestamp(payload.collected_at)],
    ['הרוגים — כוחותינו', payload.blue_death_count ?? unknown],
    ['פצועים — כוחותינו', payload.blue_injured_count ?? unknown],
    ['הרוגים — אויב', payload.red_death_count ?? unknown],
    ['פצועים — אויב', payload.red_injured_count ?? unknown],
    ['רמת דחיפות', `${urgency.label}${payload.threat_level === null ? '' : ` (${payload.threat_level})`}`],
    ['מקור מידע', payload.channel_name || payload.account_name || payload.platform],
  ];
  const extraFields = [
    ['פלטפורמה', payload.platform], ['חשבון', payload.account_name ?? unknown],
    ['ערוץ', payload.channel_name ?? unknown], ['סוג מקור', payload.is_official ? 'רשמי' : 'פתוח'],
    ['שפת מקור', payload.original_language ?? unknown], ['זמן פרסום', timestamp(payload.published_at)],
    ['קו רוחב', payload.lat ?? unknown], ['קו אורך', payload.long ?? unknown],
    ['תוכן מתורגם', payload.translated_content ?? unknown], ['כתובת מקור', payload.report_url],
    ['גרסת סכמה', payload.schema_version], ['גרסת מודל', payload.fastbreak_model_version ?? unknown],
    ['מציאות', payload.reality_id], ['תבנית מקור', report.template_id ?? 'ללא תבנית ספרייה'],
  ];

  return (
    <div className="ai-details-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="ai-report-details-title" className="drawer ai-details-drawer" onKeyDown={(event) => {
        if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
        if (event.key === 'Tab') {
          const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), summary');
          const first = controls?.[0];
          const last = controls?.[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
        <header className="drawer-head">
          <div className="drawer-head-main">
            <div className="ai-card-topline">
            <span className="ai-report-tag">דיווח</span>
            <span className={`ai-kind ai-kind-${report.kind}`}>{REPORT_KIND_LABELS[report.kind]}</span>
            <span className="ai-kind">{report.category_name}</span>
            <span className="ai-offset" dir="ltr">T+{formatOffset(report.dispatch_offset_s)}</span>
            {report.origin === 'library' && <span className="ai-report-tag">עותק מהספרייה</span>}
            </div>
            <h2 id="ai-report-details-title" className="drawer-title">{aiReportTitle(report)}</h2>
            <p className="drawer-desc">{payload.original_content}</p>
          </div>
          <button type="button" className="ai-icon-button" aria-label="סגירת פרטי הדיווח" onClick={onClose}><CloseIcon /></button>
        </header>
        <div className="drawer-body">
          <section aria-labelledby="ai-details-main-heading">
            <h3 id="ai-details-main-heading" className="drawer-sec-title">מידע מרכזי</h3>
            <dl className="kgrid ai-details-fields">{mainFields.map(([label, value], index) => (
              <div key={label} className={`kcell${index === 0 ? ' wide' : ''}`}>
                <dt className="k-l">{label}</dt>
                <dd className={`k-v${value === unknown ? ' unk' : ''}${label === 'רמת דחיפות' ? ` ai-report-urgency ai-urgency-${urgency.level}` : ''}`}>{value}</dd>
              </div>
            ))}</dl>
          </section>
          <section aria-labelledby="ai-details-location-heading">
            <h3 id="ai-details-location-heading" className="drawer-sec-title">מיקום</h3>
            <div className="ai-details-location">
              <strong>{payload.city || 'מיקום לא ידוע'}</strong>
              <span>{payload.lat !== null && payload.long !== null ? `${payload.lat}, ${payload.long}` : 'קואורדינטות לא ידועות'}</span>
              <small>דיוק המיקום לא נמסר בדיווח.</small>
            </div>
          </section>
          <details className="ai-details-extra">
            <summary>פרטים נוספים · {extraFields.length} שדות</summary>
            <dl className="kgrid ai-details-fields">{extraFields.map(([label, value]) => <div className="kcell" key={label}><dt className="k-l">{label}</dt><dd className={`k-v${value === unknown ? ' unk' : ''}`}>{value}</dd></div>)}</dl>
          </details>
        </div>
        <footer className="drawer-foot">
          <button type="button" className="ai-button ai-button-primary" disabled={busy} onClick={onEdit}><PencilIcon size={14} />עריכה</button>
          <button type="button" className="ai-button" disabled={busy} onClick={onRemove}>הסרה מהסימולציה</button>
          <button type="button" className="ai-report-text-action" onClick={onClose}>סגירה</button>
        </footer>
      </aside>
    </div>
  );
}
