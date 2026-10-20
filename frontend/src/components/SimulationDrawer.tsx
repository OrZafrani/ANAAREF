import { useEffect } from 'react';
import { Simulation } from '../types/simulation';
import { DIFFICULTY_PRESETS } from '../data/difficulty';
import { SYSTEM_INFO } from '../lib/appSettings';
import type { SimulationRun } from '../lib/runsApi';
import { formatRelativeRunTime, runDuration, runStatusLabel } from '../lib/runFormat';
import { CloseIcon, PlayCircleIcon, TrashIcon } from './Icons';
import './SimulationDrawer.css';

interface SimulationDrawerProps {
  simulation: Simulation;
  onClose: () => void;
  onDelete: (id: string) => void;
  /** This simulation's runs, newest first. */
  runs: SimulationRun[];
  activeRun: SimulationRun | null;
  now: number;
  /** Why the simulation can't run now, or null. */
  runBlockReason: string | null;
  pendingRunAction: string | null;
  runActionError: string;
  onRun: () => void;
  onStop: (run: SimulationRun) => void;
}

export function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'לא ידוע';
  const time = date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return `היום, ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `אתמול, ${time}`;
  return `${date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })} · ${time}`;
}

export function DifficultyBadge({ difficulty }: { difficulty: Simulation['difficulty'] }) {
  const level = DIFFICULTY_PRESETS[difficulty]?.level ?? 2;
  return (
    <span className="badge b-diff">
      <span className={`lv lv-${level}`} aria-hidden="true"><i /><i /><i /></span>
      {difficulty}
    </span>
  );
}

export default function SimulationDrawer({
  simulation, onClose, onDelete, runs, activeRun, now,
  runBlockReason, pendingRunAction, runActionError, onRun, onStop,
}: SimulationDrawerProps) {
  const preset = DIFFICULTY_PRESETS[simulation.difficulty];
  const ownActiveRun = activeRun?.simulation_id === simulation.id ? activeRun : null;
  const events = [...simulation.events].sort((a, b) => a.minute - b.minute);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="sim-drawer-title">
        <header className="drawer-head">
          <div className="drawer-head-main">
            <div className="chips">
              <span className="badge b-ok">שמורה</span>
              <DifficultyBadge difficulty={simulation.difficulty} />
              <span className="badge b-sys">{SYSTEM_INFO[simulation.sys ?? 'spectre'].name}</span>
            </div>
            <h2 className="drawer-title" id="sim-drawer-title">{simulation.title}</h2>
            {simulation.description && <p className="drawer-desc">{simulation.description}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="סגירה">
            <CloseIcon size={18} />
          </button>
        </header>

        <div className="drawer-body">
          <section>
            <h3 className="h3 drawer-sec-title">הגדרות</h3>
            <div className="kgrid">
              <div className="kcell"><span className="k-l">רמת קושי</span><span className="k-v">{simulation.difficulty}</span></div>
              <div className="kcell"><span className="k-l">אירועים</span><span className="k-v mono">{simulation.events.length}</span></div>
              <div className="kcell">
                <span className="k-l">משך</span>
                {preset.durationMin != null
                  ? <span className="k-v"><span className="mono">{preset.durationMin}</span> דק׳</span>
                  : <span className="k-v unk">לא ידוע</span>}
              </div>
              <div className="kcell">
                <span className="k-l">קצב</span>
                {preset.ratePerMin != null
                  ? <span className="k-v"><span className="mono">{preset.ratePerMin}</span> לדק׳</span>
                  : <span className="k-v unk">לא ידוע</span>}
              </div>
              <div className="kcell wide"><span className="k-l">נוצרה</span><span className="k-v">{formatWhen(simulation.createdAt)}</span></div>
            </div>
          </section>

          <section>
            <h3 className="h3 drawer-sec-title">אירועים לפי סדר הזרמה · {events.length}</h3>
            {events.length === 0 ? (
              <p className="hint">לא נבחרו אירועים לסימולציה זו.</p>
            ) : (
              <ol className="mini-items">
                {events.map((event) => (
                  <li className="mini-item" key={event.id}>
                    <span className="mini-t mono">T+{event.minute}</span>
                    <div className="mini-main">
                      <span className="mini-title">{event.title}</span>
                      <span className="mini-desc">{event.description}</span>
                    </div>
                    <span className="tag">{event.category}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section>
            <h3 className="h3 drawer-sec-title">היסטוריית ריצות · {runs.length}</h3>
            {runs.length === 0 ? (
              <p className="hint">הסימולציה עדיין לא הורצה.</p>
            ) : (
              <ol className="run-history">
                {runs.map((run) => (
                  <li className="run-history-item" key={run.id}>
                    <span className={`run-status status-${run.status}`}>{runStatusLabel(run.status)}</span>
                    <div className="run-history-main">
                      <time dateTime={run.started_at}>{formatRelativeRunTime(run.started_at, now)}</time>
                      <span className="mini-desc">
                        {runDuration(run, now)} · נשלחו <span className="mono">{run.dispatched_count}</span> מתוך <span className="mono">{run.report_count}</span> דיווחים
                      </span>
                      {run.status === 'failed' && run.failure_reason && (
                        <span className="run-history-reason">{run.failure_reason}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <footer className="drawer-foot">
          {runActionError && <p className="drawer-run-error" role="alert">{runActionError}</p>}
          <button type="button" className="btn btn-secondary" onClick={onClose}>סגירה</button>
          {ownActiveRun ? (
            <button
              type="button"
              className="btn btn-danger-ghost"
              onClick={() => onStop(ownActiveRun)}
              disabled={pendingRunAction !== null}
            >
              {pendingRunAction === 'stop' ? 'עוצר…' : 'עצירת הריצה'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-run"
              onClick={onRun}
              aria-disabled={runBlockReason !== null || pendingRunAction !== null}
              title={runBlockReason ?? 'הרצת הסימולציה'}
            >
              <PlayCircleIcon size={16} />
              {pendingRunAction === `start:${simulation.id}` ? 'מפעיל…' : 'הרצה'}
            </button>
          )}
          <button type="button" className="btn btn-danger-ghost drawer-delete" onClick={() => onDelete(simulation.id)}>
            <TrashIcon size={16} />
            מחיקה
          </button>
        </footer>
      </aside>
    </>
  );
}
