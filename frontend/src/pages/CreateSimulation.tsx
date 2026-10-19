import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DifficultyLevel, SimulationFormData } from '../types/simulation';
import { ArrowLeftIcon } from '../components/Icons';
import './CreateSimulation.css';

const DIFFICULTY_OPTIONS: { level: DifficultyLevel; description: string }[] = [
  {
    level: 'קל',
    description: 'תרחיש בסיסי המבוסס על נהלים קבועים וזמני תגובה גמישים.',
  },
  {
    level: 'בינוני',
    description: 'אירוע משולב עם לחץ זמנים מתון ודרישה לקבלת החלטות מהירה.',
  },
  {
    level: 'קשה',
    description: 'אירוע מורכב, רב-מוקדי ובתנאי אי-ודאות מבצעית גבוהה.',
  },
  {
    level: 'מומחה',
    description: 'תרחיש קיצון משולב במקביל עם עומס תקלות ואירועי חירום.',
  },
];

export default function CreateSimulation() {
  const navigate = useNavigate();

  // Retrieve any draft state if available
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

  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});

  const validate = () => {
    const newErrors: { title?: string; description?: string } = {};
    if (!formData.title.trim()) {
      newErrors.title = 'נא להזין כותרת לסימולציה';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'הכותרת קצרה מדי (לפחות 3 תווים)';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'נא להזין תיאור מפורט לסימולציה';
    } else if (formData.description.trim().length < 8) {
      newErrors.description = 'התיאור קצר מדי (לפחות 8 תווים)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      return;
    }

    // Save to session storage
    sessionStorage.setItem('cobra_sim_draft', JSON.stringify(formData));

    // Move to event selection page
    navigate('/simulations/events', { state: formData });
  };

  return (
    <div className="create-sim-container">
      <div className="create-sim-header">
        <nav className="sim-breadcrumb">
          <button type="button" onClick={() => navigate('/')}>
            דף הבית
          </button>
          <span>/</span>
          <span>יצירת סימולציה</span>
        </nav>
        <h1 className="create-sim-title">יצירת סימולציה חדשה</h1>
        <p className="create-sim-subtitle">
          הגדר את פרטי הבסיס של התרחיש המבצעי לפני בחירת האירועים
        </p>
      </div>

      {/* Stepper */}
      <div className="stepper-bar">
        <div className="stepper-item stepper-item-active">
          <span className="stepper-num">1</span>
          <span>פרטי הסימולציה</span>
        </div>
        <div className="stepper-divider" />
        <div className="stepper-item">
          <span className="stepper-num">2</span>
          <span>בחירת אירועים</span>
        </div>
      </div>

      <form className="create-sim-form" onSubmit={handleSubmit} noValidate>
        {/* Title Field */}
        <div className="form-group">
          <label htmlFor="sim-title" className="form-label">
            <span>כותרת הסימולציה</span>
            <span className="required-mark">*</span>
          </label>
          <p className="form-hint">שם קצר ומדויק המזהה את אופי התרחיש המבצעי</p>
          <input
            id="sim-title"
            type="text"
            className={`form-input ${errors.title ? 'input-error' : ''}`}
            placeholder="לדוגמה: תרגיל תגובה לאירוע חדירה בגזרה הצפונית"
            value={formData.title}
            onChange={(e) => {
              setFormData({ ...formData, title: e.target.value });
              if (errors.title) setErrors({ ...errors, title: undefined });
            }}
          />
          {errors.title && <p className="error-text">{errors.title}</p>}
        </div>

        {/* Description Field */}
        <div className="form-group">
          <label htmlFor="sim-desc" className="form-label">
            <span>תיאור הסימולציה</span>
            <span className="required-mark">*</span>
          </label>
          <p className="form-hint">פירוט הרקע, מטרות האימון, הכוחות המעורבים והאתגרים הצפויים</p>
          <textarea
            id="sim-desc"
            className={`form-textarea ${errors.description ? 'input-error' : ''}`}
            placeholder="פרט כאן את מהלך התרחיש, תנאי השטח והנחיות הפעולה לצוות..."
            rows={4}
            value={formData.description}
            onChange={(e) => {
              setFormData({ ...formData, description: e.target.value });
              if (errors.description) setErrors({ ...errors, description: undefined });
            }}
          />
          {errors.description && <p className="error-text">{errors.description}</p>}
        </div>

        {/* Difficulty Field */}
        <div className="form-group">
          <label className="form-label">
            <span>רמת קושי</span>
            <span className="required-mark">*</span>
          </label>
          <p className="form-hint">קביעת דרגת המורכבות ועומס האירועים במהלך הסימולציה</p>
          <div className="difficulty-grid">
            {DIFFICULTY_OPTIONS.map((opt) => {
              const isSelected = formData.difficulty === opt.level;
              return (
                <div
                  key={opt.level}
                  className={`difficulty-card ${isSelected ? 'difficulty-card-selected' : ''}`}
                  onClick={() => setFormData({ ...formData, difficulty: opt.level })}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setFormData({ ...formData, difficulty: opt.level });
                    }
                  }}
                >
                  <div className="difficulty-card-top">
                    <span className="difficulty-title">{opt.level}</span>
                    <span className={`difficulty-tag difficulty-tag-${opt.level}`}>
                      דרגה
                    </span>
                  </div>
                  <p className="difficulty-desc">{opt.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/')}
          >
            ביטול וחזרה
          </button>
          <button type="submit" className="btn-primary">
            <span>המשך לבחירת אירועים</span>
            <ArrowLeftIcon size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
