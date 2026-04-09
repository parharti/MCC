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

  const fullPath = location.pathname + location.search;
  const isOnEntries = location.pathname === '/entries';
  const isOnReport = location.pathname === '/report';
  const currentMediaType = new URLSearchParams(location.search).get('mediaType');

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/nvd-logo.png" alt="NVD Logo" className="sidebar-logo-img" />
          <div className="sidebar-brand-text">
            <span>{t.sidebarBrand}</span>
            <span className="sidebar-brand-sub">{t.sidebarSub}</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <button
            className={`sidebar-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
            onClick={() => navigate('/dashboard')}
          >
            {t.dashboard}
          </button>

          {/* All Complaints as parent with expand/collapse */}
          <button
            className={`sidebar-link sidebar-parent ${isOnEntries && !currentMediaType ? 'active' : ''}`}
            onClick={() => { navigate('/entries'); setCdOpen(prev => !prev); }}
          >
            <span>{t.allComplaints}</span>
            <span className="sidebar-arrow">{cdOpen ? '\u25BC' : '\u25B6'}</span>
          </button>
          {cdOpen && (
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
                onClick={() => { navigate('/report'); setReportOpen(prev => !prev); }}
              >
                <span>{t.report}</span>
                <span className="sidebar-arrow">{reportOpen ? '\u25BC' : '\u25B6'}</span>
              </button>
              {reportOpen && (
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
          >
            {t.changePassword}
          </button>
        </nav>
        <div className="sidebar-footer">
          Media Tracker Portal
        </div>
      </aside>

      {showChangePwd && (
        <ChangePasswordModal onClose={() => setShowChangePwd(false)} />
      )}
    </>
  );
}
