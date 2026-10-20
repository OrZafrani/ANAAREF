import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NewSimulationModal from '../components/NewSimulationModal';
import { deleteSimulation, listSimulations } from '../lib/api';
import SimulationDrawer, { DifficultyBadge, formatWhen } from '../components/SimulationDrawer';
import ConfirmDialog from '../components/ConfirmDialog';
import type { DifficultyLevel, Simulation } from '../types/simulation';
import { DIFFICULTY_FILTERS, DIFFICULTY_PRESETS } from '../data/difficulty';
import { getCategoryTree } from '../lib/libraryApi';
import { SYSTEM_INFO, useAppSettings } from '../lib/appSettings';
import { getRunningSimulation, getSimulationRuns, startRun, stopRun, SimulationRun } from '../lib/runsApi';
import { formatRelativeRunTime, runBlockReason, runDuration, runErrorMessage, runStatusLabel } from '../lib/runFormat';
import { ChevronDownIcon, PencilIcon, PlusIcon, PlayCircleIcon, SearchIcon, TrashIcon } from '../components/Icons';
import './Home.css';

// Refresh runs often while one is active, so progress stays current.
const ACTIVE_POLL_MS = 2_000;
const IDLE_POLL_MS = 10_000;
function hasDraft() {
  try {
    return Boolean(sessionStorage.getItem('cobra_sim_draft'));
  } catch {
    return false;
  }
}

function plannedDuration(seconds: number) {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours} שע׳ ${minutes} דק׳`;
  if (totalMinutes > 0) return `${totalMinutes} דק׳`;
  return `${Math.max(0, seconds)} שנ׳`;
}

function runTargetLabel(target: SimulationRun['target_system']) {
  return target === 'specter' ? SYSTEM_INFO.spectre.name : SYSTEM_INFO.cm.name;
}

function formatRunStart(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('he-IL');
}

function estimatedEnd(run: SimulationRun) {
  const startedAt = new Date(run.started_at).getTime();
  return Number.isNaN(startedAt) ? null : new Date(startedAt + run.simulation_length_s * 1000).toISOString();
}

export default function Home() {
  const navigate = useNavigate();
  const { sys } = useAppSettings();
  const sysInfo = SYSTEM_INFO[sys];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allSimulations, setAllSimulations] = useState<Simulation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [simulationToDelete, setSimulationToDelete] = useState<Simulation | null>(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyLevel | 'all'>('all');
  const [libraryCount, setLibraryCount] = useState<number | null>(null);
  const [recentRuns, setRecentRuns] = useState<SimulationRun[]>([]);
  const [showAllDayRuns, setShowAllDayRuns] = useState(false);
  const [activeRun, setActiveRun] = useState<SimulationRun | null>(null);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState(false);
  // Why a clicked simulation can't run, shown on its card (and in its drawer).
  const [runActionError, setRunActionError] = useState<{ simulationId: string; message: string } | null>(null);
  // The run or stop waiting for confirmation, and the error of its request, if any.
  const [confirming, setConfirming] = useState<
    { kind: 'start'; simulation: Simulation } | { kind: 'stop'; run: SimulationRun } | null
  >(null);
  const [confirmError, setConfirmError] = useState('');
  // 'start:<simulationId>' or 'stop' while that request is in flight.
  const [pendingRunAction, setPendingRunAction] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const draftOpen = hasDraft();

  useEffect(() => {
    let isMounted = true;
    listSimulations()
      .then((results) => {
        if (isMounted) setAllSimulations(results);
      })
      .catch((loadError: unknown) => {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : 'טעינת הסימולציות נכשלה');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getCategoryTree()
      .then((tree) => {
        if (active) setLibraryCount(tree.reduce((sum, category) => sum + category.report_count, 0));
      })
      .catch(() => {
        if (active) setLibraryCount(null);
      });
    return () => { active = false; };
  }, []);

  const refreshRuns = useCallback(async () => {
    const [runsResult, activeResult] = await Promise.allSettled([
      getSimulationRuns(),
      getRunningSimulation(),
    ]);
    if (runsResult.status === 'fulfilled') {
      setRecentRuns(runsResult.value);
      setRunsError(false);
    } else {
      setRunsError(true);
    }
    if (activeResult.status === 'fulfilled') setActiveRun(activeResult.value);
    setRunsLoading(false);
    setNow(Date.now());
  }, []);

  const isRunActive = activeRun !== null;
  useEffect(() => {
    void refreshRuns();
    const interval = window.setInterval(() => void refreshRuns(), isRunActive ? ACTIVE_POLL_MS : IDLE_POLL_MS);
    return () => window.clearInterval(interval);
  }, [refreshRuns, isRunActive]);

  const runsFromLastDay = useMemo(() => {
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    return recentRuns.filter((run) => {
      const startedAt = new Date(run.started_at).getTime();
      return !Number.isNaN(startedAt) && startedAt >= oneDayAgo && startedAt <= now;
    });
  }, [recentRuns, now]);
  const latestFiveRuns = recentRuns.slice(0, 5);
  const visibleRuns = showAllDayRuns ? runsFromLastDay : latestFiveRuns;
  const hasDifferentRunViews = runsFromLastDay.length > 5
    || latestFiveRuns.some((run) => !runsFromLastDay.some((dayRun) => dayRun.id === run.id));

  // Simulations saved before the system switch existed have no sys and belong to SPECTRE.
  const simulations = useMemo(
    () => allSimulations.filter((sim) => (sim.sys ?? 'spectre') === sys),
    [allSimulations, sys],
  );

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return simulations.filter((sim) => {
      if (difficulty !== 'all' && sim.difficulty !== difficulty) return false;
      if (!query) return true;
      return `${sim.title} ${sim.description}`.toLocaleLowerCase().includes(query);
    });
  }, [simulations, search, difficulty]);

  const byDifficulty = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>;
    for (const sim of simulations) counts[DIFFICULTY_PRESETS[sim.difficulty]?.level ?? 2] += 1;
    return counts;
  }, [simulations]);

  const openSimulation = allSimulations.find((sim) => sim.id === openId) ?? null;
  const filtersActive = difficulty !== 'all' || search.trim() !== '';

  const handleConfirmDelete = async () => {
    if (!simulationToDelete) return;
    const { id } = simulationToDelete;
    setIsDeleting(id);
    setError('');
    try {
      await deleteSimulation(id);
      setAllSimulations((current) => current.filter((simulation) => simulation.id !== id));
      if (openId === id) setOpenId(null);
      setSimulationToDelete(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'מחיקת הסימולציה נכשלה');
    } finally {
      setIsDeleting(null);
    }
  };

  const requestDeleteSimulation = (id: string) => {
    const simulation = allSimulations.find((item) => item.id === id);
    if (simulation) setSimulationToDelete(simulation);
  };

  /** Run button: explains on the card why it can't run, or asks for confirmation. */
  const handleStartRun = (simulation: Simulation) => {
    if (pendingRunAction !== null) return;
    const blocked = runBlockReason(simulation, activeRun);
    if (blocked) {
      setRunActionError({ simulationId: simulation.id, message: blocked });
      return;
    }
    setRunActionError(null);
    setConfirmError('');
    setConfirming({ kind: 'start', simulation });
  };

  const handleStopRun = (run: SimulationRun) => {
    if (pendingRunAction !== null) return;
    setConfirmError('');
    setConfirming({ kind: 'stop', run });
  };

  const closeConfirm = useCallback(() => setConfirming(null), []);

  /** Sends the confirmed start or stop. On failure the dialog stays open with the reason. */
  const handleConfirm = async () => {
    if (!confirming) return;
    const action = confirming.kind;
    setConfirmError('');
    setPendingRunAction(action === 'start' ? `start:${confirming.simulation.id}` : 'stop');
    try {
      if (action === 'start') await startRun(confirming.simulation.id);
      else await stopRun(confirming.run.simulation_id, confirming.run.id);
      setConfirming(null);
    } catch (runError) {
      setConfirmError(runErrorMessage(runError, action));
    } finally {
      // Also after a failure: a 409 means another run started, or this one ended, meanwhile.
      await refreshRuns();
      setPendingRunAction(null);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setDifficulty('all');
  };

  return (
    <div className="dash">
      <div className="dash-actions">
        <button type="button" className="btn btn-neutral btn-lg" onClick={() => setIsModalOpen(true)}>
          <PlusIcon size={18} />
          <span>סימולציה חדשה</span>
        </button>
      </div>

      <div className="dash-head">
        <h1 className="h1">לוח בקרה</h1>
        <p className="lede">{sysInfo.lede}</p>
      </div>

      <section className="dash-sec" aria-labelledby="active-title">
        <h2 className="dash-sec-title" id="active-title">סימולציה פעילה</h2>
        {activeRun ? (
          <div className="card active-run-card">
            <div className="active-run-head">
              <PlayCircleIcon size={18} />
              <span><strong>{activeRun.simulation_name}</strong> · {runTargetLabel(activeRun.target_system)} · התחילה {formatRunStart(activeRun.started_at)}</span>
              <span className="run-status status-started">פעילה · {runDuration(activeRun, now)}</span>
              <button
                type="button"
                className="btn btn-danger-ghost btn-sm active-run-stop"
                onClick={() => handleStopRun(activeRun)}
                disabled={pendingRunAction !== null}
              >
                {pendingRunAction === 'stop' ? 'עוצר…' : 'עצירת הריצה'}
              </button>
            </div>
            <div className="active-run-progress">
              <div
                className="run-progress"
                role="progressbar"
                aria-label="התקדמות הריצה"
                aria-valuemin={0}
                aria-valuemax={activeRun.report_count}
                aria-valuenow={activeRun.dispatched_count}
              >
                <span style={{ width: `${activeRun.report_count > 0 ? Math.min(100, (activeRun.dispatched_count / activeRun.report_count) * 100) : 0}%` }} />
              </div>
              <span className="run-progress-label">
                נשלחו <span className="mono">{activeRun.dispatched_count}</span> מתוך <span className="mono">{activeRun.report_count}</span> דיווחים
                · משך מתוכנן {plannedDuration(activeRun.simulation_length_s)}
              </span>
            </div>
          </div>
        ) : (
          <div className="card active-empty">
            <PlayCircleIcon size={18} />
            <span>{runsLoading ? 'בודק אם יש סימולציה פעילה…' : `אין סימולציה פעילה כרגע. ניתן להריץ סימולציה אחת בכל פעם.`}</span>
          </div>
        )}
      </section>

      <section className="dash-sec" aria-labelledby="saved-title">
        <h2 className="dash-sec-title" id="saved-title">
          סימולציות שמורות
          <span className="sec-count mono">{simulations.length}</span>
        </h2>

        <div className="kpis">
          <div className="kpi">
            <span className="kpi-l">סימולציות במערכת</span>
            <span className="kpi-v mono">{simulations.length}</span>
            <span className="kpi-s">נשמרו עבור {sysInfo.name}</span>
          </div>
          <div className="kpi">
            <span className="kpi-l">טיוטות</span>
            <span className="kpi-v mono">{draftOpen ? 1 : 0}</span>
            <span className="kpi-s">{draftOpen ? 'טיוטה פתוחה בדפדפן זה, עד השמירה' : 'אין טיוטה פתוחה'}</span>
          </div>
          <div className="kpi">
            <span className="kpi-l">{sysInfo.unitItems} בספרייה</span>
            <span className="kpi-v mono">{libraryCount ?? '—'}</span>
            <span className="kpi-s">{libraryCount == null ? 'לא ניתן לטעון את הספרייה' : 'תבניות בספריית התוכן'}</span>
          </div>
          <div className="kpi">
            <span className="kpi-l">פילוח לפי רמת קושי</span>
            <div className="dbar" aria-hidden="true">
              {simulations.length > 0 && <>
                <span className="ds-easy" style={{ flexGrow: byDifficulty[1] }} />
                <span className="ds-medium" style={{ flexGrow: byDifficulty[2] }} />
                <span className="ds-hard" style={{ flexGrow: byDifficulty[3] }} />
              </>}
            </div>
            <div className="dlegend">
              <span><i className="ds-easy" />קל {byDifficulty[1]}</span>
              <span><i className="ds-medium" />בינוני {byDifficulty[2]}</span>
              <span><i className="ds-hard" />קשה {byDifficulty[3]}</span>
            </div>
          </div>
        </div>

        {error && <p role="alert">{error}</p>}
        {isLoading && <p role="status">טוען סימולציות...</p>}
        <div className="card dash-toolbar">
          <label className="search">
            <SearchIcon className="ic" size={18} />
            <input
              type="search"
              aria-label="חיפוש סימולציות"
              placeholder="חיפוש לפי שם או תיאור"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="chips" role="group" aria-label="סינון לפי רמת קושי">
            <span className="chips-l">קושי</span>
            <button type="button" className={`chip ${difficulty === 'all' ? 'on' : ''}`} aria-pressed={difficulty === 'all'} onClick={() => setDifficulty('all')}>הכל</button>
            {DIFFICULTY_FILTERS.map((level) => (
              <button key={level} type="button" className={`chip ${difficulty === level ? 'on' : ''}`} aria-pressed={difficulty === level} onClick={() => setDifficulty(level)}>
                {level}
              </button>
            ))}
          </div>
          <span className="dash-count">מוצגות {visible.length} מתוך {simulations.length}</span>
        </div>

        {visible.length > 0 ? (
          <div className="sim-grid">
            {visible.map((sim) => {
              const preset = DIFFICULTY_PRESETS[sim.difficulty];
              const categories = Array.from(new Set(sim.events.map((event) => event.category))).slice(0, 3);
              const isRunning = activeRun?.simulation_id === sim.id;
              const blockReason = runBlockReason(sim, activeRun);
              return (
                <article key={sim.id} className="card sim-card">
                  <span className="badge b-var sim-creation-badge">
                    {sim.aiGenerated ? 'נוצרה בAI' : 'נוצרה ידנית'}
                  </span>
                  <div className="chips">
                    {isRunning
                      ? <span className="badge run-status status-started">רצה כעת</span>
                      : <span className="badge b-ok">שמורה</span>}
                    <DifficultyBadge difficulty={sim.difficulty} />
                  </div>
                  <h3 className="sc-title">
                    <button type="button" className="linklike" onClick={() => setOpenId(sim.id)}>{sim.title}</button>
                  </h3>
                  <p className="sc-desc">{sim.description || 'ללא תיאור'}</p>
                  {categories.length > 0 && (
                    <div className="chips">
                      {categories.map((category) => <span className="tag" key={category}>{category}</span>)}
                    </div>
                  )}
                  <dl className="meta">
                    <div><dt>אירועים</dt><dd className="mono">{sim.events.length}</dd></div>
                    <div><dt>משך</dt><dd>{preset.durationMin != null ? <><span className="mono">{preset.durationMin}</span> דק׳</> : '—'}</dd></div>
                    <div><dt>קצב</dt><dd>{preset.ratePerMin != null ? <><span className="mono">{preset.ratePerMin}</span> לדק׳</> : '—'}</dd></div>
                  </dl>
                  <div className="sc-foot">
                    <span className="sc-upd">נוצרה {formatWhen(sim.createdAt)}</span>
                    <div className="sc-actions">
                      <button
                        type="button"
                        className="icon-btn edit-sim-btn"
                        onClick={() => navigate(`/simulations/${encodeURIComponent(sim.id)}/edit/events`)}
                        aria-label={`עריכת הסימולציה ${sim.title}`}
                        title="עריכת סימולציה"
                      >
                        <PencilIcon size={16} />
                        <span>עריכה</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-run btn-sm run-sim-btn"
                        onClick={() => handleStartRun(sim)}
                        // aria-disabled, not disabled: a click on a blocked button explains why.
                        aria-disabled={blockReason !== null || pendingRunAction !== null}
                        aria-label={`הרצת הסימולציה ${sim.title}`}
                        title={blockReason ?? 'הרצת הסימולציה'}
                      >
                        <PlayCircleIcon size={16} />
                        <span>{pendingRunAction === `start:${sim.id}` ? 'מפעיל…' : 'הרצה'}</span>
                      </button>
                      <button
                        type="button"
                        className="icon-btn delete-sim-btn"
                        onClick={() => requestDeleteSimulation(sim.id)}
                        aria-label={`מחיקת הסימולציה ${sim.title}`}
                        title="מחיקת סימולציה"
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </div>
                  {runActionError?.simulationId === sim.id && (
                    <p className="sc-run-error" role="alert">{runActionError.message}</p>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="card dash-empty">
            <div className="empty-art"><SearchIcon size={26} /></div>
            {filtersActive ? <>
              <h3>לא נמצאו סימולציות</h3>
              <p>אין סימולציות שתואמות לחיפוש או לסינון שנבחרו.</p>
              <button type="button" className="btn btn-secondary" onClick={clearFilters}>ניקוי סינון</button>
            </> : <>
              <h3>עדיין אין סימולציות ב-{sysInfo.name}</h3>
              <p>סימולציה שתישמר בבונה תופיע כאן.</p>
              <button type="button" className="btn btn-primary" onClick={() => setIsModalOpen(true)}>יצירת סימולציה</button>
            </>}
          </div>
        )}
      </section>

      <section className="dash-sec" aria-labelledby="runs-title">
        <h2 className="dash-sec-title" id="runs-title">
          ריצות אחרונות
          <span className="sec-count mono">{visibleRuns.length}</span>
        </h2>
        <div className="card runs">
          <div id="recent-runs-list">
            <div className="run-row run-head" aria-hidden="true">
              <span>סימולציה</span>
              <span>מערכת יעד</span>
              <span>זמן שליחה</span>
              <span>משך</span>
              <span>סטטוס משוער</span>
            </div>
            {runsLoading ? (
              <p className="runs-empty">טוען ריצות אחרונות…</p>
            ) : runsError ? (
              <p className="runs-empty" role="status">לא ניתן לטעון את הריצות האחרונות כרגע.</p>
            ) : visibleRuns.length === 0 ? (
              <p className="runs-empty">{showAllDayRuns ? 'לא היו ריצות ב־24 השעות האחרונות.' : 'עדיין לא הורצו סימולציות.'}</p>
            ) : visibleRuns.map((run) => (
              <div className="run-row" key={run.id}>
                <span className="run-name" title={run.simulation_name}>{run.simulation_name}</span>
                <span>{runTargetLabel(run.target_system)}</span>
                <time dateTime={run.started_at}>{formatRelativeRunTime(run.started_at, now)}</time>
                <span>{plannedDuration(run.simulation_length_s)}</span>
                <div className="run-status-cell">
                  <span className={`run-status status-${run.status}`}>{runStatusLabel(run.status)}</span>
                  {/* The estimate only describes a run that is still going. */}
                  {run.status === 'started' && <>
                    <span className="run-estimate">{estimatedEnd(run) && now >= new Date(estimatedEnd(run)!).getTime() ? 'משך הריצה חלף' : 'הריצה בעיצומה'}</span>
                    {estimatedEnd(run) && <span className="run-estimate-end">סיום משוער: {formatRelativeRunTime(estimatedEnd(run)!, now)}</span>}
                  </>}
                  {run.status !== 'started' && (
                    <span className="run-estimate">נשלחו {run.dispatched_count} מתוך {run.report_count}</span>
                  )}
                  {run.status === 'failed' && run.failure_reason && (
                    <span className="run-estimate-end" title={run.failure_reason}>{run.failure_reason}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!runsLoading && !runsError && hasDifferentRunViews && (
            <button
              type="button"
              className="run-expand-toggle"
              aria-expanded={showAllDayRuns}
              aria-controls="recent-runs-list"
              onClick={() => setShowAllDayRuns((expanded) => !expanded)}
            >
              <span>{showAllDayRuns ? 'הצג את 5 הריצות האחרונות' : `הצג את כל ${runsFromLastDay.length} הריצות מ־24 השעות האחרונות`}</span>
              <ChevronDownIcon className={showAllDayRuns ? 'is-expanded' : ''} size={17} />
            </button>
          )}
        </div>
      </section>

      <NewSimulationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {simulationToDelete && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => {
            if (isDeleting !== simulationToDelete.id) setSimulationToDelete(null);
          }}
        >
          <div
            className="modal-card delete-confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-simulation-title"
            aria-describedby="delete-simulation-description"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-header-text">
                <h2 id="delete-simulation-title">מחיקת סימולציה</h2>
                <p id="delete-simulation-description">
                  האם למחוק את הסימולציה ״{simulationToDelete.title}״? לא ניתן לבטל פעולה זו.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="modal-cancel-btn"
                disabled={isDeleting === simulationToDelete.id}
                onClick={() => setSimulationToDelete(null)}
              >
                ביטול
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={isDeleting === simulationToDelete.id}
                onClick={handleConfirmDelete}
              >
                {isDeleting === simulationToDelete.id ? 'מוחק...' : 'מחיקה'}
              </button>
            </div>
          </div>
        </div>
      )}

      {openSimulation && (
        <SimulationDrawer
          simulation={openSimulation}
          onClose={() => setOpenId(null)}
          onDelete={requestDeleteSimulation}
          runs={recentRuns.filter((run) => run.simulation_id === openSimulation.id)}
          activeRun={activeRun}
          now={now}
          runBlockReason={runBlockReason(openSimulation, activeRun)}
          pendingRunAction={pendingRunAction}
          runActionError={runActionError?.simulationId === openSimulation.id ? runActionError.message : ''}
          onRun={() => handleStartRun(openSimulation)}
          onStop={handleStopRun}
        />
      )}

      {confirming?.kind === 'start' && (() => {
        const sim = confirming.simulation;
        const target = SYSTEM_INFO[sim.sys ?? 'spectre'];
        const durationMin = DIFFICULTY_PRESETS[sim.difficulty]?.durationMin;
        return (
          <ConfirmDialog
            eyebrow="הרצת סימולציה"
            title={`להריץ את „${sim.title}"?`}
            rows={[
              { label: 'מערכת יעד', value: <span className="badge b-sys">{target.name}</span> },
              { label: 'תוכן', value: <><span className="mono">{sim.events.length}</span> {target.unitItems}</> },
              { label: 'משך ורמה', value: <>{durationMin != null ? <><span className="mono">{durationMin}</span> דק׳ · </> : null}רמה {sim.difficulty}</> },
            ]}
            confirmLabel="אישור והרצה"
            confirmIcon={<PlayCircleIcon size={16} />}
            variant="run"
            busy={pendingRunAction !== null}
            busyLabel="מפעיל…"
            error={confirmError}
            onConfirm={handleConfirm}
            onCancel={closeConfirm}
          >
            הסימולציה תישלח מיד ל-{target.name}
            {durationMin != null ? `, וצפויה להסתיים בעוד ${durationMin} דק׳ מרגע השליחה` : ''}.
            {' '}עד לסיום המשוער לא ניתן יהיה להריץ סימולציה נוספת.
          </ConfirmDialog>
        );
      })()}

      {confirming?.kind === 'stop' && (() => {
        // Prefer the latest poll, so the progress shown is current.
        const run = activeRun?.id === confirming.run.id ? activeRun : confirming.run;
        return (
          <ConfirmDialog
            eyebrow="עצירת ריצה"
            title={`לעצור את „${run.simulation_name}"?`}
            rows={[
              { label: 'מערכת יעד', value: <span className="badge b-sys">{runTargetLabel(run.target_system)}</span> },
              { label: 'התקדמות', value: <>נשלחו <span className="mono">{run.dispatched_count}</span> מתוך <span className="mono">{run.report_count}</span></> },
              { label: 'זמן ריצה', value: runDuration(run, now) },
            ]}
            confirmLabel="עצירת הריצה"
            variant="danger"
            busy={pendingRunAction !== null}
            busyLabel="עוצר…"
            error={confirmError}
            onConfirm={handleConfirm}
            onCancel={closeConfirm}
          >
            דיווחים שכבר נשלחו לא יבוטלו. הריצה תסומן כ״נעצרה״ ולא ניתן יהיה להמשיך אותה.
          </ConfirmDialog>
        );
      })()}
    </div>
  );
}
