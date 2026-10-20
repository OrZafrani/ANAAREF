import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CloseIcon } from '../Icons';
import { aiReportTitle } from '../../lib/aiSimulation';
import type { AiSimulationReport } from '../../types/aiSimulation';

interface Props {
  report: AiSimulationReport;
  durationSeconds: number;
  onSave: (report: AiSimulationReport) => void;
  onClose: () => void;
}

const casualtyFields = [
  ['blue_death_count', 'הרוגים — כוחותינו'],
  ['blue_injured_count', 'פצועים — כוחותינו'],
  ['red_death_count', 'הרוגים — אויב'],
  ['red_injured_count', 'פצועים — אויב'],
] as const;

function numberField(data: FormData, key: string, min: number, max: number, integer = false): number | null {
  const text = String(data.get(key) ?? '').trim();
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) {
    throw new Error('יש להזין מספרים תקינים בטווח המותר; ספירות נפגעים חייבות להיות שלמות ולא שליליות.');
  }
  return value;
}

export default function AiReportEditor({ report, durationSeconds, onSave, onClose }: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const [error, setError] = useState('');
  const payload = report.payload;

  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.querySelector<HTMLElement>('input')?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    try {
      const data = new FormData(event.currentTarget);
      const title = String(data.get('report_title') ?? '').trim();
      const content = String(data.get('original_content') ?? '').trim();
      const minute = numberField(data, 'minute', 0, durationSeconds / 60);
      if (!title || !content || minute === null) throw new Error('כותרת, תוכן ועיתוי הם שדות חובה.');
      onSave({
        ...report,
        dispatch_offset_s: Math.round(minute * 60),
        payload: {
          ...payload,
          report_title: title,
          original_content: content,
          city: String(data.get('city') ?? '').trim() || null,
          lat: numberField(data, 'lat', -90, 90),
          long: numberField(data, 'long', -180, 180),
          threat_level: numberField(data, 'threat_level', 0, 100, true),
          blue_death_count: numberField(data, 'blue_death_count', 0, Number.MAX_SAFE_INTEGER, true),
          blue_injured_count: numberField(data, 'blue_injured_count', 0, Number.MAX_SAFE_INTEGER, true),
          red_death_count: numberField(data, 'red_death_count', 0, Number.MAX_SAFE_INTEGER, true),
          red_injured_count: numberField(data, 'red_injured_count', 0, Number.MAX_SAFE_INTEGER, true),
        },
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'שמירת הדיווח נכשלה.');
    }
  };

  return (
    <div className="ai-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="ai-report-editor-title" className="ai-panel ai-report-editor" onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
        if (event.key === 'Tab') {
          const fields = dialogRef.current?.querySelectorAll<HTMLElement>('button, input, textarea');
          const first = fields?.[0];
          const last = fields?.[fields.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
        <header className="ai-panel-heading">
          <div><h2 id="ai-report-editor-title">עריכת דיווח בסימולציה</h2><p>השינויים חלים על העותק הזה בלבד. הספרייה אינה משתנה.</p></div>
          <button type="button" className="ai-icon-button" aria-label="סגירת עורך הדיווח" onClick={onClose}><CloseIcon /></button>
        </header>
        <form onSubmit={submit}>
          <div className="ai-editor-fields">
            {error && <p role="alert" className="ai-alert">{error}</p>}
            <label>כותרת<input name="report_title" required maxLength={500} defaultValue={payload.report_title ? aiReportTitle(report) : ''} /></label>
            <label>תוכן הדיווח<textarea name="original_content" required rows={4} maxLength={50000} defaultValue={payload.original_content} /></label>
            <div className="ai-field-grid">
              <label>עיתוי בסימולציה (דקה)<input name="minute" required type="number" min={0} max={durationSeconds / 60} step="any" defaultValue={report.dispatch_offset_s / 60} /></label>
              <label>רמת איום (0–100)<input name="threat_level" type="number" min={0} max={100} step={1} defaultValue={payload.threat_level ?? ''} placeholder="לא ידוע" /></label>
              <label>עיר<input name="city" maxLength={200} defaultValue={payload.city ?? ''} /></label>
              <label>קו רוחב<input name="lat" type="number" min={-90} max={90} step="any" defaultValue={payload.lat ?? ''} placeholder="לא ידוע" /></label>
              <label>קו אורך<input name="long" type="number" min={-180} max={180} step="any" defaultValue={payload.long ?? ''} placeholder="לא ידוע" /></label>
            </div>
            <h3>נפגעים</h3>
            <p className="ai-muted">שדה ריק = לא ידוע. 0 = אפס מאומת.</p>
            <div className="ai-field-grid">
              {casualtyFields.map(([key, label]) => <label key={key}>{label}<input name={key} type="number" min={0} step={1} placeholder="לא ידוע" defaultValue={payload[key] ?? ''} /></label>)}
            </div>
          </div>
          <footer className="ai-actions">
            <button type="submit" className="ai-button ai-button-primary">שמירת שינויים</button>
            <button type="button" className="ai-button" onClick={onClose}>ביטול</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
