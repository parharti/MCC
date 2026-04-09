import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import ChangePasswordModal from './ChangePasswordModal';

export default function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLang();
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [cdOpen, setCdOpen] = useState(true);
  const [reportOpen, setReportOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const fullPath = location.pathname + location.search;
  const isOnEntries = location.pathname === '/entries';
  const isOnReport = location.pathname === '/report';
  const currentMediaType = new URLSearchParams(location.search).get('mediaType');

  return (
    <>
      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-brand">
          <img src="/nvd-logo.png" alt="NVD Logo" className="sidebar-logo-img" />
          {!collapsed && (
            <div className="sidebar-brand-text">
              <span>{t.sidebarBrand}</span>
              <span className="sidebar-brand-sub">{t.sidebarSub}</span>
            </div>
          )}
        </div>
        <nav className="sidebar-nav">
          <button
            className={`sidebar-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
            onClick={() => navigate('/dashboard')}
            title={collapsed ? t.dashboard : ''}
          >
            <span className="sidebar-icon">&#9632;</span>
            {!collapsed && <span className="sidebar-text">{t.dashboard}</span>}
          </button>

          {/* All Complaints as parent with expand/collapse */}
          <button
            className={`sidebar-link sidebar-parent ${isOnEntries && !currentMediaType ? 'active' : ''}`}
            onClick={() => { navigate('/entries'); if (!collapsed) setCdOpen(prev => !prev); }}
            title={collapsed ? t.allComplaints : ''}
          >
            <span className="sidebar-icon">&#128196;</span>
            {!collapsed && <span className="sidebar-text">{t.allComplaints}</span>}
            {!collapsed && <span className="sidebar-arrow">{cdOpen ? '\u25BC' : '\u25B6'}</span>}
          </button>
          {!collapsed && cdOpen && (
            <div className="sidebar-sub-links">
              <button
                className={`sidebar-link sidebar-sub-link ${isOnEntries && currentMediaType === 'social_media' ? 'active' : ''}`}
                onClick={() => navigate('/entries?mediaType=social_media')}
              >
                {t.socialMedia}
              </button>
              <button
                className={`sidebar-link sidebar-sub-link ${isOnEntries && currentMediaType === 'print_media' ? 'active' : ''}`}
                onClick={() => navigate('/entries?mediaType=print_media')}
              >
                {t.printMedia}
              </button>
              <button
                className={`sidebar-link sidebar-sub-link ${isOnEntries && currentMediaType === 'electronic_media' ? 'active' : ''}`}
                onClick={() => navigate('/entries?mediaType=electronic_media')}
              >
                {t.electronicMedia}
              </button>
            </div>
          )}

          {user.role === 'admin' && (
            <>
              <button
                className={`sidebar-link sidebar-parent ${isOnReport && !currentMediaType ? 'active' : ''}`}
                onClick={() => { navigate('/report'); if (!collapsed) setReportOpen(prev => !prev); }}
                title={collapsed ? t.report : ''}
              >
                <span className="sidebar-icon">&#128202;</span>
                {!collapsed && <span className="sidebar-text">{t.report}</span>}
                {!collapsed && <span className="sidebar-arrow">{reportOpen ? '\u25BC' : '\u25B6'}</span>}
              </button>
              {!collapsed && reportOpen && (
                <div className="sidebar-sub-links">
                  <button
                    className={`sidebar-link sidebar-sub-link ${isOnReport && currentMediaType === 'social_media' ? 'active' : ''}`}
                    onClick={() => navigate('/report?mediaType=social_media')}
                  >
                    {t.socialMedia}
                  </button>
                  <button
                    className={`sidebar-link sidebar-sub-link ${isOnReport && currentMediaType === 'print_media' ? 'active' : ''}`}
                    onClick={() => navigate('/report?mediaType=print_media')}
                  >
                    {t.printMedia}
                  </button>
                  <button
                    className={`sidebar-link sidebar-sub-link ${isOnReport && currentMediaType === 'electronic_media' ? 'active' : ''}`}
                    onClick={() => navigate('/report?mediaType=electronic_media')}
                  >
                    {t.electronicMedia}
                  </button>
                </div>
              )}
            </>
          )}

          <button
            className="sidebar-link"
            onClick={() => setShowChangePwd(true)}
            title={collapsed ? t.changePassword : ''}
          >
            <span className="sidebar-icon">&#128274;</span>
            {!collapsed && <span className="sidebar-text">{t.changePassword}</span>}
          </button>
        </nav>

        <button className="sidebar-collapse-btn" onClick={() => setCollapsed(c => !c)}>
          {collapsed ? '\u25B6' : '\u25C0'}
        </button>

        {!collapsed && (
          <div className="sidebar-footer">
            Media Tracker Portal
          </div>
        )}
      </aside>

      {showChangePwd && (
        <ChangePasswordModal onClose={() => setShowChangePwd(false)} />
      )}
    </>
  );
}
