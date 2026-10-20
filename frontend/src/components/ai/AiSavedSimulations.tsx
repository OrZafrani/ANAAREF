import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AiIcon, TrashIcon } from '../Icons';
import { DIFFICULTY_PRESETS } from '../../lib/aiSimulation';
import { deleteAiSimulation, loadAiSimulations } from '../../lib/aiSimulationStorage';
import type { AiSimulationDraft } from '../../types/aiSimulation';
import './AiSavedSimulations.css';

export default function AiSavedSimulations() {
  const [simulations, setSimulations] = useState<AiSimulationDraft[]>([]);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    try {
      setSimulations(loadAiSimulations());
    } catch (loadError) {
      setError(`טעינת סימולציות AI מקומיות נכשלה: ${loadError instanceof Error ? loadError.message : 'שגיאה לא צפויה'}`);
    }
  }, []);

  const remove = (id: string) => {
    try {
      deleteAiSimulation(id);
      setSimulations((current) => current.filter((item) => item.simulation.id !== id));
      setConfirmDelete(null);
      setError('');
    } catch (deleteError) {
      setError(`מחיקת הסימולציה נכשלה: ${deleteError instanceof Error ? deleteError.message : 'שגיאה לא צפויה'}`);
    }
  };

  if (!error && simulations.length === 0) return null;
  return (
    <section className="ai-saved" aria-labelledby="ai-saved-title">
      <h3 id="ai-saved-title"><AiIcon size={20} />סימולציות AI מקומיות ({simulations.length})</h3>
      <p>טיוטות שנשמרו בדפדפן זה בלבד, כולל נתונים ישנים ממצב ההדגמה. סימולציות שנשמרו במסד הנתונים מופיעות ברשימה הראשית.</p>
      {error && <p role="alert" className="ai-saved-error">{error}</p>}
      <div className="ai-saved-grid">
        {simulations.map((draft) => <article key={draft.simulation.id} className="ai-saved-card">
          <div className="ai-saved-badges"><span>בונה AI</span><span>{draft.status === 'saved' ? 'שמורה מקומית' : 'טיוטה'}</span><span>{DIFFICULTY_PRESETS[draft.simulation.difficulty].label}</span></div>
          <h4>{draft.simulation.name || 'טיוטת AI ללא שם'}</h4>
          <p>{draft.simulation.description || 'טרם נוסף תיאור'}</p>
          <small>{draft.reports.length} דיווחים · {draft.simulation.length_s / 60} דקות</small>
          <footer>
            <Link to={`/simulations/ai?id=${encodeURIComponent(draft.simulation.id)}`}>המשך עריכה</Link>
            <button type="button" aria-label={`מחיקת סימולציית AI: ${draft.simulation.name || 'טיוטה'}`} onClick={() => setConfirmDelete(draft.simulation.id)}><TrashIcon size={16} /></button>
          </footer>
          {confirmDelete === draft.simulation.id && <div className="ai-saved-confirm" role="alert">
            <p>למחוק את הסימולציה המקומית? פעולה זו אינה ניתנת לביטול.</p>
            <button type="button" onClick={() => remove(draft.simulation.id)}>אישור מחיקה</button>
            <button type="button" onClick={() => setConfirmDelete(null)}>ביטול</button>
          </div>}
        </article>)}
      </div>
    </section>
  );
}
