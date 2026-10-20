import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AiIcon, SignalBarsIcon } from '../Icons';
import { DEMO_PROMPTS } from '../../data/aiSimulationFixtures';
import { DIFFICULTY_PRESETS, reportCount } from '../../lib/aiSimulation';
import type { AiSimulationDraft, AiSimulationSettings, GenerationSettings } from '../../types/aiSimulation';

interface Props {
  draft: AiSimulationDraft;
  busy: boolean;
  onSend: (message: string) => Promise<boolean>;
  onSettings: (simulation: AiSimulationSettings, generation: GenerationSettings) => void;
  onGenerate: () => void;
}

export default function AiScenarioSetup({ draft, busy, onSend, onSettings, onGenerate }: Props) {
  const [message, setMessage] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const { simulation, generation } = draft;
  const preset = DIFFICULTY_PRESETS[simulation.difficulty];
  const totalPercent = generation.duplicate_percent + generation.false_percent + generation.noise_percent;

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
          <div><h2 id="ai-chat-heading">בניית הסימולציה בשיחה</h2><p>תארו וחדדו את התרחיש. ההגדרות לצדו נשארות בשליטתכם.</p></div>
        </header>
        <div ref={logRef} className="ai-chat-log" role="log" aria-label="שיחה עם עוזר הסימולציה" aria-live="polite">
          {draft.messages.map((item) => (
            <article key={item.id} className={`ai-message ai-message-${item.role}`}>
              <strong>{item.role === 'assistant' ? 'עוזר הסימולציה · הדגמה' : 'אתם'}</strong>
              <p>{item.content}</p>
            </article>
          ))}
          {busy && <p role="status" className="ai-working">מעבד את התרחיש במצב הדגמה…</p>}
        </div>
        <fieldset disabled={busy} className="ai-fieldset">
          {draft.messages.length === 1 && (
            <div className="ai-suggestions">
              <span>דוגמאות לפתיחה</span>
              {DEMO_PROMPTS.map((prompt) => <button type="button" key={prompt} onClick={() => void send(prompt)}>{prompt}</button>)}
            </div>
          )}
          <form className="ai-composer" onSubmit={submit}>
            <label htmlFor="ai-message">הודעה לעוזר הסימולציה</label>
            <div>
              <textarea id="ai-message" rows={3} maxLength={2000} placeholder="תארו תרחיש, הוסיפו תקרית או בקשו שינוי…" value={message} onChange={(event) => setMessage(event.target.value)} />
              <button type="submit" className="ai-button ai-button-primary" disabled={!message.trim()}>שליחה</button>
            </div>
          </form>
        </fieldset>
      </section>

      <section className="ai-panel ai-settings" aria-labelledby="ai-settings-heading">
        <header className="ai-panel-heading"><div><h2 id="ai-settings-heading">הגדרות הסימולציה</h2><p>SPECTRE · אפשר לערוך בכל שלב</p></div></header>
        <fieldset disabled={busy} className="ai-fieldset ai-settings-fields">
          <label htmlFor="ai-name">שם הסימולציה <span className="ai-required">חובה</span>
            <input id="ai-name" required maxLength={200} placeholder="יתמלא לפי השיחה, או הקלידו שם" value={simulation.name} onChange={(event) => onSettings({ ...simulation, name: event.target.value }, generation)} />
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
                  { ...DIFFICULTY_PRESETS[difficulty].generation },
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
            <input id="ai-duration" type="range" min={10} max={120} step={1} value={simulation.length_s / 60} onChange={(event) => onSettings({ ...simulation, length_s: Number(event.target.value) * 60 }, generation)} />
            <small>ברירת מחדל ({preset.label}): {preset.length_s / 60} דקות</small>
          </label>
          <details className="ai-advanced">
            <summary>הגדרות מתקדמות · כפולים, שגויים ורעש רקע</summary>
            {([
              ['duplicate_percent', 'דיווחים כפולים', 50],
              ['false_percent', 'דיווחים שגויים', 50],
              ['noise_percent', 'רעש רקע', 60],
            ] as const).map(([key, label, max]) => (
              <label key={key} htmlFor={`ai-${key}`}>{label} <output>{generation[key]}%</output>
                <input id={`ai-${key}`} type="range" min={0} max={max} step={1} value={generation[key]} onChange={(event) => onSettings(simulation, { ...generation, [key]: Number(event.target.value) })} />
              </label>
            ))}
            <small className={totalPercent >= 100 ? 'ai-invalid' : ''}>
              {totalPercent < 100 ? `${100 - totalPercent}% מהדיווחים יישארו מקוריים (בקירוב, לאחר עיגול).` : 'סך ההסחות חייב להיות קטן מ-100%.'}
            </small>
          </details>
          <div className="ai-generation-summary">
            <strong>{reportCount(simulation, generation)} דיווחים מתוכננים</strong>
            <small>{simulation.length_s / 60} דקות · {generation.reports_per_minute} דיווחים לדקה</small>
          </div>
          <button type="button" className="ai-button ai-button-primary ai-full-width" onClick={onGenerate} disabled={totalPercent >= 100}>
            <AiIcon size={18} />{draft.reports.length ? 'יצירת הסימולציה מחדש' : 'יצירת הסימולציה'}
          </button>
        </fieldset>
      </section>
    </div>
  );
}
