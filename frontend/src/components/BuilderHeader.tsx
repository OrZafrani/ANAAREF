import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon, PlusIcon } from './Icons';
import NewSimulationModal from './NewSimulationModal';
import { SYSTEM_INFO, useAppSettings } from '../lib/appSettings';
import './BuilderHeader.css';

interface BuilderHeaderProps {
  title: string;
  currentStep: 1 | 2 | 3;
  onStepClick?: (step: 1 | 2 | 3) => void;
  onSave?: () => void;
  onSaveDraft?: () => void;
  isSaved?: boolean;
  isEditing?: boolean;
  saveLabel?: string;
  breadcrumb?: string;
  stepLabels?: readonly [string, string, string];
  disabled?: boolean;
  availableStep?: 1 | 2 | 3;
  statusText?: string;
  showHeaderActions?: boolean;
}

export default function BuilderHeader({
  title,
  currentStep,
  onStepClick,
  onSave,
  onSaveDraft,
  isSaved = true,
  isEditing = false,
  saveLabel = 'שמירה',
  breadcrumb,
  stepLabels = ['פרטים והגדרות', 'תוכן', 'סקירה ושמירה'],
  disabled = false,
  availableStep = 3,
  statusText,
  showHeaderActions = true,
}: BuilderHeaderProps) {
  const navigate = useNavigate();
  const { sys } = useAppSettings();
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
              disabled={disabled}
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
                disabled={disabled}
                onClick={() => navigate('/')}
                title="חזרה ללוח הבקרה"
              >
                <span>לוח הבקרה</span>
                <ArrowRightIcon size={16} />
              </button>

              <div className="title-section">
                <span className="sub-title-breadcrumb">
                  {breadcrumb ?? (isEditing ? 'בונה ידני · עריכת סימולציה' : 'בונה ידני · סימולציה חדשה')}
                </span>
                <h1 className="main-title">{title.trim() ? title : 'סימולציה ללא שם'}</h1>
              </div>
            </div>

            {/* Left side (RTL actions) */}
            {showHeaderActions && <div className="top-bar-left">
              <span className="badge b-sys">{SYSTEM_INFO[sys].name}</span>

              <span className="save-status">
                <CheckIcon size={14} />
                <span>{statusText ?? (isSaved ? 'אין שינויים' : 'נשמר כטיוטה')}</span>
              </span>

              <button
                type="button"
                className="top-text-btn"
                disabled={disabled}
                onClick={() => navigate('/')}
              >
                סגירה
              </button>

              <button
                type="button"
                className="top-outline-btn"
                onClick={onSaveDraft}
                disabled={disabled}
              >
                שמירה כטיוטה
              </button>

              <button
                type="button"
                className="top-gold-btn"
                onClick={onSave}
                disabled={disabled}
              >
                {saveLabel}
              </button>
            </div>}
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
              disabled={disabled}
              aria-current={currentStep === 1 ? 'step' : undefined}
              onClick={() => onStepClick && onStepClick(1)}
            >
              <span className="step-circle">1</span>
              <span className="step-label">{stepLabels[0]}</span>
            </button>

            <button
              type="button"
              className={`stepper-pill ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}`}
              disabled={disabled || availableStep < 2}
              aria-current={currentStep === 2 ? 'step' : undefined}
              onClick={() => onStepClick && onStepClick(2)}
            >
              <span className="step-circle">2</span>
              <span className="step-label">{stepLabels[1]}</span>
            </button>

            <button
              type="button"
              className={`stepper-pill ${currentStep === 3 ? 'active' : ''}`}
              disabled={disabled || availableStep < 3}
              aria-current={currentStep === 3 ? 'step' : undefined}
              onClick={() => onStepClick && onStepClick(3)}
            >
              <span className="step-circle">3</span>
              <span className="step-label">{stepLabels[2]}</span>
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
