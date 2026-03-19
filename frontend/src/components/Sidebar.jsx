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

  const links = [
    { path: '/dashboard', label: t.dashboard },
    { path: '/entries', label: t.entries },
    ...(user.role === 'admin' ? [
      { path: '/report', label: t.report },
    ] : []),
  ];

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">MCC</div>
          <div className="sidebar-brand-text">
            <span>{t.sidebarBrand}</span>
            <span className="sidebar-brand-sub">{t.sidebarSub}</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {links.map(link => (
            <button
              key={link.path}
              className={`sidebar-link ${location.pathname === link.path ? 'active' : ''}`}
              onClick={() => navigate(link.path)}
            >
              {link.label}
            </button>
          ))}
          {user.role === 'district' && (
            <button
              className="sidebar-link"
              onClick={() => setShowChangePwd(true)}
            >
              {t.changePassword}
            </button>
          )}
        </nav>
        <div className="sidebar-footer">
          MCC Violation Tracking Portal
        </div>
      </aside>

      {showChangePwd && (
        <ChangePasswordModal onClose={() => setShowChangePwd(false)} />
      )}
    </>
  );
}
