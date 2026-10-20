import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AiIcon, SignalBarsIcon } from '../Icons';
import { DIFFICULTY_PRESETS, NOISE_LABELS, reportCount, SCENARIO_EXAMPLES } from '../../lib/aiSimulation';
import type { AiSimulationDraft, AiSimulationSettings, GenerationSettings } from '../../types/aiSimulation';

interface Props {
  draft: AiSimulationDraft;
  busy: boolean;
  onSend: (message: string) => Promise<boolean>;
  onSettings: (simulation: AiSimulationSettings, generation: GenerationSettings) => void;
  onGenerate: () => void;
  onExample: (example: typeof SCENARIO_EXAMPLES[number]) => void;
}

export default function AiScenarioSetup({ draft, busy, onSend, onSettings, onGenerate, onExample }: Props) {
  const [message, setMessage] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const { simulation, generation } = draft;
  const preset = DIFFICULTY_PRESETS[simulation.difficulty];
  const count = reportCount(simulation, generation);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [draft.messages, busy]);

  const send = async (text: string) => {
    if (text.trim() && await onSend(text.trim())) setMessage('');
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send(message);
  };

  return (
    <div className="ai-setup-grid">
      <section className="ai-panel ai-conversation" aria-labelledby="ai-chat-heading">
        <header className="ai-panel-heading">
          <span className="ai-heading-icon"><AiIcon size={22} /></span>
          <div><h2 id="ai-chat-heading">תיאור התרחיש</h2><p>התיאור משמש ליצירת דיווחים בלבד. יש למלא את ההגדרות בנפרד.</p></div>
        </header>
        <div ref={logRef} className="ai-chat-log" role="log" aria-label="שיחה עם עוזר הסימולציה" aria-live="polite">
          {draft.messages.map((item) => (
            <article key={item.id} className={`ai-message ai-message-${item.role}`}>
              <strong>{item.role === 'assistant' ? 'הנחיות המערכת' : 'אתם'}</strong>
              <p>{item.content}</p>
            </article>
          ))}
        </div>
        <fieldset disabled={busy} className="ai-fieldset">
          <details className="ai-suggestions">
            <summary>דוגמאות לתרחישים · בחירה תחיל את הגדרות הדוגמה</summary>
            {SCENARIO_EXAMPLES.map((example) => <button type="button" key={example.title} onClick={() => { onExample(example); setMessage(''); }}>{example.title}</button>)}
          </details>
          {draft.scenario && <div className="ai-generation-summary"><strong>התיאור הפעיל ליצירה הבאה</strong><p>{draft.scenario}</p>
            <button type="button" className="ai-report-text-action" onClick={() => setMessage(draft.scenario)}>עריכת התיאור הפעיל</button>
          </div>}
          <form className="ai-composer" onSubmit={submit}>
            <label htmlFor="ai-message">הודעה לעוזר הסימולציה</label>
            <div>
              <textarea id="ai-message" rows={3} minLength={10} maxLength={2000} placeholder="תארו אירוע עם שמות ומקומות מומצאים. תיאור חדש יחליף את התיאור הפעיל…" value={message} onChange={(event) => setMessage(event.target.value)} />
              <button type="submit" className="ai-button ai-button-primary" disabled={message.trim().length < 10}>שליחה</button>
            </div>
          </form>
        </fieldset>
      </section>

      <section className="ai-panel ai-settings" aria-labelledby="ai-settings-heading">
        <header className="ai-panel-heading"><div><h2 id="ai-settings-heading">הגדרות הסימולציה</h2><p>SPECTRE · אפשר לערוך בכל שלב</p></div></header>
        <fieldset disabled={busy} className="ai-fieldset ai-settings-fields">
          <label htmlFor="ai-name">שם הסימולציה <span className="ai-required">חובה</span>
            <input id="ai-name" required maxLength={200} placeholder="הקלידו שם לסימולציה" value={simulation.name} onChange={(event) => onSettings({ ...simulation, name: event.target.value }, generation)} />
          </label>
          <label htmlFor="ai-description">תיאור הסימולציה <span className="ai-required">חובה</span>
            <textarea id="ai-description" required rows={3} maxLength={4000} placeholder="משפט שמסכם את ההקשר ואת מטרת התרגיל" value={simulation.description} onChange={(event) => onSettings({ ...simulation, description: event.target.value }, generation)} />
          </label>
          <div>
            <span className="ai-field-label">רמת קושי</span>
            <div className="ai-difficulty" role="group" aria-label="רמת קושי">
              {(['easy', 'medium', 'hard'] as const).map((difficulty, index) => (
                <button key={difficulty} type="button" aria-pressed={simulation.difficulty === difficulty} onClick={() => onSettings(
                  { ...simulation, difficulty, length_s: DIFFICULTY_PRESETS[difficulty].length_s },
                  { ...generation, ...DIFFICULTY_PRESETS[difficulty].generation },
                )}>
                  <SignalBarsIcon level={index === 0 ? 1 : index === 1 ? 2 : 3} size={16} />{DIFFICULTY_PRESETS[difficulty].label}
                </button>
              ))}
            </div>
            <small>בחירת רמה מחילה מחדש את ברירות המחדל של ההזרמה.</small>
          </div>
          <label htmlFor="ai-rate">קצב הזרמת דיווחים <output>{generation.reports_per_minute} לדק׳</output>
            <input id="ai-rate" type="range" min={0.5} max={12} step={0.5} value={generation.reports_per_minute} onChange={(event) => onSettings(simulation, { ...generation, reports_per_minute: Number(event.target.value) })} />
            <small>ברירת מחדל ({preset.label}): {preset.generation.reports_per_minute} לדקה · דיווח כל {Math.round(60 / generation.reports_per_minute)} שניות</small>
          </label>
          <label htmlFor="ai-duration">משך הסימולציה <output>{simulation.length_s / 60} דק׳</output>
            <input id="ai-duration" type="range" min={1} max={120} step={1} value={simulation.length_s / 60} onChange={(event) => onSettings({ ...simulation, length_s: Number(event.target.value) * 60 }, generation)} />
            <small>ברירת מחדל ({preset.label}): {preset.length_s / 60} דקות</small>
          </label>
          <div>
            <span className="ai-field-label">רמת רעש רקע</span>
            <div className="ai-difficulty" role="group" aria-label="רמת רעש רקע">
              {(['low', 'medium', 'high'] as const).map((noise_level) => <button key={noise_level} type="button"
                aria-pressed={generation.noise_level === noise_level}
                onClick={() => onSettings(simulation, { ...generation, noise_level })}>{NOISE_LABELS[noise_level]}</button>)}
            </div>
            <small>מתאר את כמות הדיווחים שאינם קשורים לאירוע המרכזי אותו בוחנים</small>
          </div>
          <label>אזור התרחיש<input required maxLength={200} value={generation.region} placeholder="תיאור האזור והמיקום הבדיוני"
            onChange={(event) => onSettings(simulation, { ...generation, region: event.target.value })} /></label>
          <label>קוד מדינה<input required maxLength={2} value={generation.country}
            onChange={(event) => onSettings(simulation, { ...generation, country: event.target.value.toUpperCase() })} /><small>שתי אותיות, למשל IL</small></label>
          <fieldset className="ai-fieldset">
            <legend className="ai-field-label">גבולות גאוגרפיים לתרחיש</legend>
            <div className="ai-field-grid">
              {([
                ['lat_min', 'קו רוחב מינימלי', -90, 90], ['lat_max', 'קו רוחב מקסימלי', -90, 90],
                ['long_min', 'קו אורך מינימלי', -180, 180], ['long_max', 'קו אורך מקסימלי', -180, 180],
              ] as const).map(([key, label, min, max]) => <label key={key}>{label}<input type="number" min={min} max={max} step="any"
                value={generation.area[key] ?? ''} required onChange={(event) => onSettings(simulation, {
                  ...generation, area: { ...generation.area, [key]: event.target.value === '' ? null : Number(event.target.value) },
                })} /></label>)}
            </div>
            <small>נדרשים על ידי שירות ה-AI. יש להגדיר אזור מתאים לתרחיש.</small>
          </fieldset>
          <div className="ai-generation-summary">
            <strong className={count > 100 ? 'ai-invalid' : ''}>{count} דיווחים מתוכננים</strong>
            <small>{simulation.length_s / 60} דקות · {generation.reports_per_minute} דיווחים לדקה</small>
          </div>
          <small className={count > 100 ? 'ai-invalid' : ''}>עד 100 דיווחים ליצירה. הקצב והמשך קובעים את הכמות המבוקשת; זמני ההזרמה יגיעו מהשירות.</small>
          <button type="button" className="ai-button ai-button-primary ai-full-width" onClick={onGenerate} disabled={count > 100}>
            <AiIcon size={18} />{draft.reports.length ? 'יצירת הסימולציה מחדש' : 'יצירת הסימולציה'}
          </button>
        </fieldset>
      </section>
    </div>
  );
}
