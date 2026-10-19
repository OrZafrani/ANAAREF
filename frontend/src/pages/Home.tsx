import  { useEffect, useState } from 'react';
import NewSimulationModal from '../components/NewSimulationModal';
import { Simulation } from '../types/simulation';
import { PlusIcon, LayersIcon, TrashIcon } from '../components/Icons';
import './Home.css';

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [simulations, setSimulations] = useState<Simulation[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cobra_simulations');
      if (stored) {
        setSimulations(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleDeleteSimulation = (id: string) => {
    const updated = simulations.filter((s) => s.id !== id);
    setSimulations(updated);
    try {
      localStorage.setItem('cobra_simulations', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  return (
    <div className="home-container">
      {/* Retain default view element */}
      <h1 className="home-title">or the king </h1>

      <section>
        {/* Action card with the "Key" / Button to create simulation */}
        <div className="sim-action-section">
          <div className="sim-action-text">
            <h2>ניהול ויצירת תרחישי סימולציה</h2>
            <p>הקמת סימולציות מבצעיות, קביעת רמת קושי ושיבוץ אירועי תגובה</p>
          </div>

          <button
            type="button"
            className="btn-new-simulation"
            onClick={() => setIsModalOpen(true)}
          >
            <PlusIcon size={18} />
            <span>סימולציה חדשה</span>
          </button>
        </div>

        {/* Existing simulations list if any */}
        {simulations.length > 0 && (
          <div className="simulations-list-section">
            <div className="simulations-list-header">
              <h3 className="simulations-list-title">
                סימולציות שמורות במערכת ({simulations.length})
              </h3>
            </div>

            <div className="sim-cards-grid">
              {simulations.map((sim) => (
                <div key={sim.id} className="saved-sim-card">
                  <div className="saved-sim-top">
                    <h4 className="saved-sim-name">{sim.title}</h4>
                    <div className="saved-sim-badges">
                      <span className={`difficulty-tag difficulty-tag-${sim.difficulty}`}>
                        רמת קושי: {sim.difficulty}
                      </span>
                    </div>
                  </div>

                  <p className="saved-sim-desc">{sim.description}</p>

                  <div className="saved-sim-footer">
                    <div className="saved-sim-events-count">
                      <LayersIcon size={15} />
                      <span>{sim.events.length} אירועים מוגדרים</span>
                    </div>

                    <button
                      type="button"
                      className="delete-sim-btn"
                      onClick={() => handleDeleteSimulation(sim.id)}
                      title="מחק סימולציה"
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Modal with Manual & AI options */}
      <NewSimulationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
