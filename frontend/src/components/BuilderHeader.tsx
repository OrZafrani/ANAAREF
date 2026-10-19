import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon, PlusIcon } from './Icons';
import NewSimulationModal from './NewSimulationModal';
import './BuilderHeader.css';

interface BuilderHeaderProps {
  title: string;
  currentStep: 1 | 2 | 3;
  onStepClick?: (step: 1 | 2 | 3) => void;
  onSave?: () => void;
  onSaveDraft?: () => void;
  isSaved?: boolean;
}

export default function BuilderHeader({
  title,
  currentStep,
  onStepClick,
  onSave,
  onSaveDraft,
  isSaved = true,
}: BuilderHeaderProps) {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      {/* White Builder Top Bar Section */}
      <div className="builder-top-bar-wrapper">
        <div className="builder-top-bar-inner">
          {/* Pre-bar containing "+ סימולציה חדשה" dark button matching mockup */}
          <div className="builder-pre-bar">
            <button
              type="button"
              className="btn-dark-new-sim"
              onClick={() => setIsModalOpen(true)}
            >
              <PlusIcon size={16} />
              <span>סימולציה חדשה</span>
            </button>
          </div>

          {/* Action Row */}
          <div className="builder-top-bar">
            {/* Right side (RTL start) */}
            <div className="top-bar-right">
              <button
                type="button"
                className="btn-back-dashboard"
                onClick={() => navigate('/')}
                title="חזרה ללוח הבקרה"
              >
                <span>לוח הבקרה</span>
                <ArrowRightIcon size={16} />
              </button>

              <div className="title-section">
                <span className="sub-title-breadcrumb">בונה ידני · סימולציה חדשה</span>
                <h1 className="main-title">{title.trim() ? title : 'סימולציה ללא שם'}</h1>
              </div>
            </div>

            {/* Left side (RTL actions) */}
            <div className="top-bar-left">
              <span className="badge-spectre">SPECTRE</span>

              <span className="save-status">
                <CheckIcon size={14} />
                <span>{isSaved ? 'אין שינויים' : 'נשמר כטיוטה'}</span>
              </span>

              <button
                type="button"
                className="top-text-btn"
                onClick={() => navigate('/')}
              >
                סגירה
              </button>

              <button
                type="button"
                className="top-outline-btn"
                onClick={onSaveDraft}
              >
                שמירה כטיוטה
              </button>

              <button
                type="button"
                className="top-gold-btn"
                onClick={onSave}
              >
                שמירה
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stepper Area (sitting on the gray background, aligned right) */}
      <div className="builder-stepper-container">
        <div className="builder-stepper-area">
          <div className="stepper-pill-group">
            <button
              type="button"
              className={`stepper-pill ${currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : ''}`}
              onClick={() => onStepClick && onStepClick(1)}
            >
              <span className="step-circle">1</span>
              <span className="step-label">פרטים והגדרות</span>
            </button>

            <button
              type="button"
              className={`stepper-pill ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}`}
              onClick={() => onStepClick && onStepClick(2)}
            >
              <span className="step-circle">2</span>
              <span className="step-label">תוכן</span>
            </button>

            <button
              type="button"
              className={`stepper-pill ${currentStep === 3 ? 'active' : ''}`}
              onClick={() => onStepClick && onStepClick(3)}
            >
              <span className="step-circle">3</span>
              <span className="step-label">סקירה ושמירה</span>
            </button>
          </div>
        </div>
      </div>

      {/* New Simulation Modal */}
      <NewSimulationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
