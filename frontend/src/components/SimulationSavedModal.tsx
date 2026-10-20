import { useEffect, useRef } from 'react';
import { CheckIcon, CloseIcon } from './Icons';
import './NewSimulationModal.css';

interface SimulationSavedModalProps {
  title: string;
  difficulty: string;
  eventCount: number;
  systemName: string;
  warning?: string;
  onDashboard: () => void;
  onCreateAnother: () => void;
}

export default function SimulationSavedModal({
  title, difficulty, eventCount, systemName, warning, onDashboard, onCreateAnother,
}: SimulationSavedModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button');
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <div className="modal-overlay" dir="rtl">
      <div className="modal-card" style={{ maxWidth: '520px' }} ref={dialogRef}
        role="dialog" aria-modal="true" aria-labelledby="simulation-saved-title" tabIndex={-1}>
        <div className="modal-header">
          <div className="modal-header-text">
            <h2 id="simulation-saved-title">הסימולציה נשמרה בהצלחה</h2>
            <p>התרחיש המבצעי הוקם ומוכן להפעלה במערכת {systemName}</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onDashboard} aria-label="סגירה וחזרה ללוח הבקרה">
            <CloseIcon size={16} />
          </button>
        </div>
        <div style={{ padding: '1.5rem 1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <span style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: 'var(--ok-soft)', color: 'var(--ok)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--ok-line)',
            }}><CheckIcon size={20} /></span>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--ink)' }}>{title}</h4>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                רמת קושי: {difficulty} · {eventCount} אירועים
              </span>
            </div>
          </div>
          {warning && <p role="alert">{warning}</p>}
        </div>
        <div className="modal-footer" style={{ gap: '0.75rem', justifyContent: 'flex-start' }}>
          <button type="button" className="modal-cancel-btn" onClick={onCreateAnother}>יצירת סימולציה נוספת</button>
          <button type="button" className="top-gold-btn" onClick={onDashboard}>חזרה ללוח הבקרה</button>
        </div>
      </div>
    </div>
  );
}
