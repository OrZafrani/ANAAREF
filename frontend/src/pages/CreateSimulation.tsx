import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BuilderHeader from '../components/BuilderHeader';
import { SignalBarsIcon, ArrowLeftIcon, ArrowRightIcon } from '../components/Icons';
import { DifficultyLevel, SimulationFormData } from '../types/simulation';
import './CreateSimulation.css';

interface DifficultyOption {
  level: DifficultyLevel;
  bars: 1 | 2 | 3;
  description: string;
  metrics: string;
}

const DIFFICULTY_CONFIG: DifficultyOption[] = [
  {
    level: 'קל',
    bars: 1,
    description: 'קצב מתון ומעט הסחות. מתאים למפעילים חדשים.',
    metrics: "2/דק'  ·  20 דק'  ·  5/5/10%",
  },
  {
    level: 'בינוני',
    bars: 2,
    description: 'קצב שגרתי-מוגבר עם הסחות בהיקף בינוני.',
    metrics: "4/דק'  ·  30 דק'  ·  15/10/25%",
  },
  {
    level: 'קשה',
    bars: 3,
    description: 'עומס גבוה, הסחות רבות ולחץ זמן.',
    metrics: "8/דק'  ·  45 דק'  ·  25/20/40%",
  },
];

export default function CreateSimulation() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState<SimulationFormData>(() => {
    try {
      const draft = sessionStorage.getItem('cobra_sim_draft');
      if (draft) {
        return JSON.parse(draft);
      }
    } catch {
      // ignore
    }
    return {
      title: '',
      description: '',
      difficulty: 'בינוני',
    };
  });

  const [errors, setErrors] = useState<{ title?: string }>({});
  const [isSavedDraft, setIsSavedDraft] = useState(true);

  const handleSaveDraft = () => {
    try {
      sessionStorage.setItem('cobra_sim_draft', JSON.stringify(formData));
      setIsSavedDraft(true);
    } catch {
      // ignore
    }
  };

  const handleNext = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.title.trim()) {
      setErrors({ title: 'נא להזין שם לסימולציה' });
      return;
    }

    // Save draft
    sessionStorage.setItem('cobra_sim_draft', JSON.stringify(formData));

    // Navigate to step 2 (content / events)
    navigate('/simulations/events', { state: formData });
  };

  return (
    <div className="builder-page-wrapper">
      {/* Top Header matching user mockup */}
      <BuilderHeader
        title={formData.title}
        currentStep={1}
        onStepClick={(step) => {
          if (step === 2 && formData.title.trim()) {
            handleNext();
          }
        }}
        onSaveDraft={handleSaveDraft}
        onSave={handleNext}
        isSaved={isSavedDraft}
      />

      <main className="builder-page-body">
        {/* Card 1: פרטי הסימולציה */}
        <section className="builder-card">
          <div className="builder-card-header">
            <h2 className="builder-card-title">פרטי הסימולציה</h2>
            <p className="builder-card-subtitle">
              הסימולציה תיבנה עבור SPECTRE, לפי המערכת שנבחרה בסרגל העליון.
            </p>
          </div>

          <div className="builder-card-divider" />

          {/* Simulation Name Field */}
          <div className="builder-form-group">
            <div className="builder-label-row">
              <label htmlFor="sim-name-input" className="builder-label">
                שם הסימולציה
              </label>
              <span className="builder-required-tag">חובה</span>
            </div>
            <input
              id="sim-name-input"
              type="text"
              className={`builder-input ${errors.title ? 'has-error' : ''}`}
              placeholder="לדוגמה: מטח פתיחה — עוטף עזה"
              value={formData.title}
              onChange={(e) => {
                setFormData({ ...formData, title: e.target.value });
                setIsSavedDraft(false);
                if (errors.title) setErrors({});
              }}
            />
            {errors.title && <p className="builder-error-msg">{errors.title}</p>}
          </div>

          {/* Simulation Description Field */}
          <div className="builder-form-group">
            <div className="builder-label-row">
              <label htmlFor="sim-desc-input" className="builder-label">
                תיאור והקשר התרחיש
              </label>
            </div>
            <textarea
              id="sim-desc-input"
              className="builder-textarea"
              placeholder="מה מתרגלים, באיזה הקשר ומה מצופה מהמפעילים"
              rows={4}
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value });
                setIsSavedDraft(false);
              }}
            />
          </div>
        </section>

        {/* Card 2: רמת קושי והגדרות הזרמה */}
        <section className="builder-card">
          <div className="builder-card-header">
            <h2 className="builder-card-title">רמת קושי והגדרות הזרמה</h2>
            <p className="builder-card-subtitle">
              רמת הקושי ממלאת ערכי פתיחה. אפשר לכוונן כל ערך בנפרד.
            </p>
          </div>

          <div className="builder-card-divider" />

          {/* 3 Difficulty Cards (קל, בינוני, קשה) */}
          <div className="difficulty-3grid">
            {DIFFICULTY_CONFIG.map((opt) => {
              const isSelected = formData.difficulty === opt.level;
              return (
                <div
                  key={opt.level}
                  className={`difficulty-pill-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    setFormData({ ...formData, difficulty: opt.level });
                    setIsSavedDraft(false);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setFormData({ ...formData, difficulty: opt.level });
                      setIsSavedDraft(false);
                    }
                  }}
                >
                  <div className="difficulty-top-row">
                    <span className="difficulty-level-name">{opt.level}</span>
                    <span className="difficulty-level-icon">
                      <SignalBarsIcon level={opt.bars} size={16} />
                    </span>
                  </div>

                  <p className="difficulty-level-desc">{opt.description}</p>

                  <div className="difficulty-level-metrics">{opt.metrics}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Bottom Navigation Bar */}
        <div className="builder-bottom-bar">
          {/* Previous Button on the right (RTL start, disabled on step 1) */}
          <button
            type="button"
            className="btn-bottom-prev"
            disabled
          >
            <ArrowRightIcon size={16} />
            <span>הקודם</span>
          </button>

          {/* Next Button on the left (RTL end) */}
          <button
            type="button"
            className="btn-bottom-next"
            onClick={handleNext}
          >
            <span>הבא</span>
            <ArrowLeftIcon size={16} />
          </button>
        </div>
      </main>
    </div>
  );
}
