import { useEffect, useRef, type ReactNode } from 'react';
import './NewSimulationModal.css';
import './ConfirmDialog.css';

interface ConfirmDialogProps {
  eyebrow: string;
  title: string;
  /** Label/value rows shown in the summary box. */
  rows: { label: string; value: ReactNode }[];
  children: ReactNode;
  confirmLabel: string;
  confirmIcon?: ReactNode;
  /** 'run' for starting something, 'danger' for stopping or removing it. */
  variant: 'run' | 'danger';
  busy: boolean;
  busyLabel: string;
  error: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A confirmation step in the app's modal style, in place of window.confirm(). */
export default function ConfirmDialog({
  eyebrow, title, rows, children, confirmLabel, confirmIcon, variant,
  busy, busyLabel, error, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // A destructive action starts on Cancel, so Enter doesn't confirm it by accident.
    (variant === 'danger' ? cancelRef : confirmRef).current?.focus();
  }, [variant]);

  useEffect(() => {
    // Capture phase, so Escape closes only this dialog and not the drawer underneath.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      if (!busy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [busy, onCancel]);

  return (
    <div className="modal-overlay" onClick={() => { if (!busy) onCancel(); }}>
      <div
        className="modal-card confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-text">
            <div className="eyebrow">{eyebrow}</div>
            <h2 id="confirm-dialog-title">{title}</h2>
          </div>
        </div>

        <div className="modal-body">
          <dl className="confirm-summary">
            {rows.map((row) => (
              <div className="confirm-row" key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="confirm-text">{children}</p>
          {error && <p className="confirm-error" role="alert">{error}</p>}
        </div>

        <div className="modal-footer">
          <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            ביטול
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn ${variant === 'run' ? 'btn-run' : 'btn-danger'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmIcon}
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
