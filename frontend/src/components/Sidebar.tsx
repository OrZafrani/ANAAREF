import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { DashboardGridIcon, ContentLibraryIcon } from './Icons';
import './Sidebar.css';

/** Title of the draft the builder keeps in sessionStorage, if one is open. */
function readDraftTitle(): string | null {
  try {
    const draft = sessionStorage.getItem('cobra_sim_draft');
    if (!draft) return null;
    const title = (JSON.parse(draft) as { title?: string }).title?.trim();
    return title || 'סימולציה ללא שם';
  } catch {
    return null;
  }
}

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [draftTitle, setDraftTitle] = useState<string | null>(readDraftTitle);

  useEffect(() => {
    setDraftTitle(readDraftTitle());
  }, [location]);

  const inBuilder = location.pathname.startsWith('/simulations/');

  return (
    <aside className="app-sidebar">
      <nav className="sidebar-nav" aria-label="ניווט ראשי">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
          title="לוח בקרה"
        >
          <span className="sidebar-item-icon">
            <DashboardGridIcon size={18} />
          </span>
          <span className="sidebar-item-text">לוח בקרה</span>
        </NavLink>

        <NavLink
          to="/content-library"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
          title="ספריית תוכן"
        >
          <span className="sidebar-item-icon">
            <ContentLibraryIcon size={18} />
          </span>
          <span className="sidebar-item-text">ספריית תוכן</span>
        </NavLink>
      </nav>

      {draftTitle && !inBuilder && (
        <button type="button" className="sidebar-draft" onClick={() => navigate('/simulations/new')}>
          <span className="sidebar-draft-title"><i aria-hidden="true" />טיוטה פתוחה</span>
          <span className="sidebar-draft-name">{draftTitle} · לא נשמרה</span>
        </button>
      )}
    </aside>
  );
}
