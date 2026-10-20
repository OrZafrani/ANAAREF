import { useEffect, useRef } from 'react';
import { AiIcon, CheckIcon } from '../Icons';
import type { GenerationStatus } from '../../types/aiSimulation';

interface Props {
  status: GenerationStatus;
  reportCount: number;
}

export default function AiGenerationLoader({ status, reportCount }: Props) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const keepFocus = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        dialogRef.current?.focus();
      }
    };
    document.addEventListener('keydown', keepFocus);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keepFocus);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  const steps = [
    'תיאור התרחיש וההגדרות מוכנים',
    status === 'queued' ? 'ממתין לשירות ה-AI' : 'ה-AI כותב ובודק את הדיווחים',
    'מוריד ומאמת את קובץ הדיווחים',
    'מכין את רצף ההזרמה לבדיקה',
  ];

  return (
    <div className="ai-generation-backdrop">
      <section ref={dialogRef} className="ai-generation-dialog" role="dialog" aria-modal="true"
        aria-labelledby="ai-generation-title" aria-describedby="ai-generation-description" tabIndex={-1}>
        <div className="ai-generation-orbit" aria-hidden="true">
          <span className="ai-generation-orbit-inner" />
          <span className="ai-generation-orbit-core"><AiIcon size={18} /></span>
        </div>
        <h2 id="ai-generation-title">ה-AI כותב דיווחים חדשים</h2>
        <p id="ai-generation-description">{reportCount} דיווחים לפי התיאור שלכם. היצירה עשויה להימשך כמה דקות.</p>
        <div className="ai-generation-track" role="progressbar" aria-label="יצירת דיווחים"
          aria-valuetext={status === 'queued' ? 'ממתין לשירות ה-AI' : 'ה-AI יוצר ובודק דיווחים; אחוז ההתקדמות אינו זמין'}>
          <span />
        </div>
        <ol className="ai-generation-steps" aria-live="polite" aria-atomic="true">
          {steps.map((step, index) => (
            <li key={index} className={index === 0 ? 'complete' : index === 1 ? 'active' : ''}
              aria-current={index === 1 ? 'step' : undefined}>
              <span className="ai-generation-step-icon" aria-hidden="true">
                {index === 0 ? <CheckIcon size={11} /> : null}
              </span>
              <span>{step}</span>
              <span className="ai-sr-only">{index === 0 ? ' — הושלם' : index === 1 ? ' — בתהליך' : ' — ממתין'}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
