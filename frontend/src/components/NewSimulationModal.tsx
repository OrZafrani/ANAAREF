import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloseIcon, ManualIcon, AiIcon, ArrowLeftIcon } from './Icons';
import { SYSTEM_INFO, useAppSettings } from '../lib/appSettings';
import './NewSimulationModal.css';

interface NewSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewSimulationModal({ isOpen, onClose }: NewSimulationModalProps) {
  const navigate = useNavigate();
  const { sys } = useAppSettings();
  const sysInfo = SYSTEM_INFO[sys];

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
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card modal-card-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-sim-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-text">
            <div className="eyebrow">סימולציה חדשה · {sysInfo.name}</div>
            <h2 id="new-sim-title">יצירת סימולציה חדשה</h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="סגור חלון"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="choice-grid">
            <button type="button" className="choice" onClick={handleSelectManual}>
              <span className="choice-ic"><ManualIcon size={22} /></span>
              <span className="choice-t">יצירה ידנית</span>
              <span className="choice-d">
                הרכבת סימולציה מ{sysInfo.unitItems} קיימים בספרייה, עם שליטה מלאה בסדר, בעיתוי ובמשתנים.
              </span>
              <ul className="choice-l">
                <li>פרטים, רמת קושי והגדרות הזרמה</li>
                <li>בחירת {sysInfo.unitItems} מהספרייה</li>
                <li>סקירה ושמירה</li>
              </ul>
              <span className="choice-go">
                התחלה
                <ArrowLeftIcon size={15} />
              </span>
            </button>

            <button
              type="button"
              className="choice"
              disabled
              title="אפשרות זו אינה זמינה כעת"
            >
              <span className="choice-ic"><AiIcon size={22} /></span>
              <span className="choice-t-row">
                <span className="choice-t">יצירה אוטומטית (AI)</span>
                <span className="badge b-diff">בקרוב</span>
              </span>
              <span className="choice-d">
                הגדרת התרחיש בטופס ובשיחה, ואז יצירת {sysInfo.unitItems} מקוריים שאפשר לערוך מיד.
              </span>
              <ul className="choice-l">
                <li>הגדרה: טופס ושיחה עם העוזר</li>
                <li>יצירה ובדיקה: עריכה והוספה מהספרייה</li>
                <li>שמירה</li>
              </ul>
              <span className="choice-note">האפשרות נמצאת בפיתוח ותהיה זמינה בגרסה עתידית.</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
