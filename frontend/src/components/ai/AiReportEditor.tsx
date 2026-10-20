import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ClockIcon, CloseIcon } from '../Icons';
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
      const minutesText = String(data.get('minutes') ?? '').trim();
      const secondsText = String(data.get('seconds') ?? '').trim();
      if (!title || !content || !minutesText || !secondsText) throw new Error('כותרת, תוכן ועיתוי הם שדות חובה.');
      const minutes = Number(minutesText);
      const seconds = Number(secondsText);
      if (!Number.isSafeInteger(minutes) || minutes < 0 || !Number.isInteger(seconds) || seconds < 0 || seconds > 59) {
        throw new Error('יש להזין דקות שלמות ולא שליליות ושניות בין 0 ל-59.');
      }
      const offset = minutes * 60 + seconds;
      if (offset > durationSeconds) throw new Error('עיתוי הדיווח חייב להיות בתוך משך הסימולציה.');
      onSave({
        ...report,
        dispatch_offset_s: offset,
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
            <fieldset className="ai-editor-timing" aria-describedby="ai-report-time-hint">
              <legend><ClockIcon size={15} />עיתוי בסימולציה</legend>
              <div className="ai-time-inputs">
                <label htmlFor="ai-report-minutes">דקות<input id="ai-report-minutes" name="minutes" required type="number" min={0} max={Math.floor(durationSeconds / 60)} step={1} defaultValue={Math.floor(report.dispatch_offset_s / 60)} aria-describedby="ai-report-time-hint" /></label>
                <span className="ai-time-separator" aria-hidden="true">:</span>
                <label htmlFor="ai-report-seconds">שניות<input id="ai-report-seconds" name="seconds" required type="number" min={0} max={59} step={1} defaultValue={report.dispatch_offset_s % 60} aria-describedby="ai-report-time-hint" /></label>
              </div>
              <p id="ai-report-time-hint">שינוי העיתוי יעדכן את מיקום הדיווח ברשימה לאחר השמירה.</p>
            </fieldset>
            <label>כותרת<input name="report_title" required maxLength={500} defaultValue={aiReportTitle(report)} /></label>
            <label>תוכן הדיווח<textarea name="original_content" required rows={4} maxLength={50000} defaultValue={payload.original_content} /></label>
            <div className="ai-field-grid">
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
