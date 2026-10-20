import type { Simulation } from '../types/simulation';
import { RunRequestError, type SimulationRun } from './runsApi';

export function runStatusLabel(status: SimulationRun['status']) {
  return {
    started: 'פעילה',
    completed: 'הושלמה',
    stopped: 'נעצרה',
    failed: 'נכשלה',
  }[status];
}

/** Time from start until completion, or until `now` while the run is going. */
export function runDuration(run: SimulationRun, now: number) {
  const end = run.completed_at ? new Date(run.completed_at).getTime() : now;
  const startedAt = new Date(run.started_at).getTime();
  if (Number.isNaN(startedAt) || Number.isNaN(end)) return '—';
  const totalSeconds = Math.max(0, Math.floor((end - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} דק׳ ${seconds} שנ׳` : `${seconds} שנ׳`;
}

export function formatRelativeRunTime(iso: string, now: number) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const today = new Date(now);
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dayLabel = dateDay === todayDay
    ? 'היום'
    : dateDay === todayDay - 24 * 60 * 60 * 1000
      ? 'אתמול'
      : date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
  const timeLabel = date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  return `${dayLabel}, ${timeLabel}`;
}

/** Why `simulation` can't be started now, or null if it can. Only one run may be active at a time. */
export function runBlockReason(simulation: Simulation, activeRun: SimulationRun | null): string | null {
  if (simulation.sys === 'cm') return 'הרצת סימולציות ניהול לחימה עדיין לא זמינה';
  if (simulation.events.length === 0) return 'אין בסימולציה אירועים להזרמה';
  if (activeRun?.simulation_id === simulation.id) return 'הסימולציה רצה כעת';
  if (activeRun) return 'סימולציה אחרת רצה כעת. ניתן להריץ סימולציה אחת בכל פעם.';
  return null;
}

// Backend 422 reasons for refusing a start, in Hebrew.
const START_REFUSALS: [RegExp, string][] = [
  [/Only Specter simulations/i, 'ניתן להריץ כרגע רק סימולציות SPECTRE.'],
  [/no reports to dispatch/i, 'אין בסימולציה אירועים להזרמה.'],
  [/reality/i, 'הסימולציה מוגדרת למציאות שאינה מציאות האימון.'],
];

/** A Hebrew explanation for a failed start or stop request. */
export function runErrorMessage(error: unknown, action: 'start' | 'stop'): string {
  const status = error instanceof RunRequestError ? error.status : 0;
  if (action === 'start') {
    if (status === 409) return 'סימולציה אחרת כבר רצה. יש לעצור אותה לפני הרצת סימולציה זו.';
    if (status === 422) {
      const message = error instanceof Error ? error.message : '';
      return START_REFUSALS.find(([pattern]) => pattern.test(message))?.[1] ?? 'לא ניתן להריץ את הסימולציה.';
    }
    if (status === 404) return 'הסימולציה לא נמצאה. ייתכן שנמחקה.';
  } else if (status === 409) {
    return 'הריצה כבר הסתיימה.';
  }
  if (status === 503) return 'מסד הנתונים אינו זמין כרגע. נסו שוב בעוד רגע.';
  return action === 'start' ? 'הפעלת הריצה נכשלה. נסו שוב.' : 'עצירת הריצה נכשלה. נסו שוב.';
}
