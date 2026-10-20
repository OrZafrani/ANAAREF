import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloseIcon, ManualIcon, AiIcon, ArrowLeftIcon } from './Icons';
import './NewSimulationModal.css';

interface NewSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewSimulationModal({ isOpen, onClose }: NewSimulationModalProps) {
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleSelectManual = () => {
    onClose();
    navigate('/simulations/new');
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-text">
            <h2>יצירת סימולציה חדשה</h2>
            <p>בחר את אופן יצירת הסימולציה להמשך התהליך</p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="סגור חלון"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* Manual / Hand Option */}
          <div
            className="option-card"
            onClick={handleSelectManual}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSelectManual();
              }
            }}
          >
            <div className="option-icon-wrap">
              <ManualIcon size={22} />
            </div>
            <div className="option-content">
              <div className="option-top-row">
                <span className="option-title">יצירה ידנית</span>
                <span className="option-badge option-badge-recommended">זמין לשימוש</span>
              </div>
              <p className="option-desc">
                הגדרת כותרת, תיאור מלא, קביעת רמת קושי ובחירת כמות וסוג האירועים בתהליך מודרך שלב אחר שלב.
              </p>
              <span className="option-action-hint">
                <span>המשך לבניית סימולציה</span>
                <ArrowLeftIcon size={14} />
              </span>
            </div>
          </div>

          {/* AI Option */}
          <div
            className="option-card"
            role="button"
            tabIndex={0}
            onClick={() => { onClose(); navigate('/simulations/ai'); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClose();
                navigate('/simulations/ai');
              }
            }}
          >
            <div className="option-icon-wrap">
              <AiIcon size={22} />
            </div>
            <div className="option-content">
              <div className="option-top-row">
                <span className="option-title">יצירה אוטומטית (AI)</span>
                <span className="option-badge option-badge-recommended">הדגמת Frontend</span>
              </div>
              <p className="option-desc">
                יצירת תרחיש סימולציה ואירועים באופן אוטומטי בהתבסס על מודלי שפה והנחיות טקסטואליות.
              </p>
              <span className="option-note">
                בנייה בשיחה, בדיקת דיווחים ושמירה מקומית. ללא חיבור לשירות AI בשלב זה.
              </span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="modal-cancel-btn" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
