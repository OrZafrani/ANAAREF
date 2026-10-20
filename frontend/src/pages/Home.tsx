import { useEffect, useMemo, useState } from 'react';
import NewSimulationModal from '../components/NewSimulationModal';
import { deleteSimulation, listSimulations } from '../lib/api';
import SimulationDrawer, { DifficultyBadge, formatWhen } from '../components/SimulationDrawer';
import type { DifficultyLevel, Simulation } from '../types/simulation';
import { DIFFICULTY_FILTERS, DIFFICULTY_PRESETS } from '../data/difficulty';
import { getCategoryTree } from '../lib/libraryApi';
import { SYSTEM_INFO, useAppSettings } from '../lib/appSettings';
import { PlusIcon, PlayCircleIcon, SearchIcon, TrashIcon } from '../components/Icons';
import './Home.css';

const DELETE_CONFIRM = 'האם אתה בטוח שברצונך למחוק את הסימולציה?';

function hasDraft() {
  try {
    return Boolean(sessionStorage.getItem('cobra_sim_draft'));
  } catch {
    return false;
  }
}

export default function Home() {
  const { sys } = useAppSettings();
  const sysInfo = SYSTEM_INFO[sys];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allSimulations, setAllSimulations] = useState<Simulation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyLevel | 'all'>('all');
  const [libraryCount, setLibraryCount] = useState<number | null>(null);
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

  const handleDeleteSimulation = async (id: string) => {
    if (!window.confirm(DELETE_CONFIRM)) return;
    setIsDeleting(id);
    setError('');
    try {
      await deleteSimulation(id);
      setAllSimulations((current) => current.filter((simulation) => simulation.id !== id));
      if (openId === id) setOpenId(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'מחיקת הסימולציה נכשלה');
    } finally {
      setIsDeleting(null);
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
        <div className="card active-empty">
          <PlayCircleIcon size={18} />
          <span>אין סימולציה פעילה ב-{sysInfo.name}. הרצת סימולציות עדיין לא זמינה במערכת.</span>
        </div>
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
              return (
                <article key={sim.id} className="card sim-card">
                  <div className="chips">
                    <span className="badge b-ok">שמורה</span>
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
                        className="icon-btn delete-sim-btn"
                        onClick={() => handleDeleteSimulation(sim.id)}
                        aria-label={`מחיקת הסימולציה ${sim.title}`}
                        title="מחיקת סימולציה"
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </div>
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
          <span className="sec-count mono">0</span>
        </h2>
        <div className="card runs">
          <div className="run-row run-head" aria-hidden="true">
            <span>סימולציה</span>
            <span>מערכת יעד</span>
            <span>זמן שליחה</span>
            <span>משך</span>
            <span>סטטוס</span>
          </div>
          <p className="runs-empty">עדיין לא הורצו סימולציות.</p>
        </div>
      </section>

      <NewSimulationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {openSimulation && (
        <SimulationDrawer
          simulation={openSimulation}
          onClose={() => setOpenId(null)}
          onDelete={handleDeleteSimulation}
        />
      )}
    </div>
  );
}
