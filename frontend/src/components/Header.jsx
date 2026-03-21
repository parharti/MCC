import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="header-title">
          Election Commission of India - Tamil Nadu
        </h1>
        <p className="header-subtitle">Media Tracker Portal</p>
      </div>
      <nav className="header-nav">
        <button
          className={`nav-btn ${location.pathname === '/dashboard' ? 'active' : ''}`}
          onClick={() => navigate('/dashboard')}
        >
          Dashboard
        </button>
        {user.role === 'admin' && (
          <button
            className={`nav-btn ${location.pathname === '/reports' ? 'active' : ''}`}
            onClick={() => navigate('/reports')}
          >
            Reports
          </button>
        )}
        <span className="user-info">
          {user.role === 'admin' ? 'Admin' : user.districtName}
        </span>
        <button className="btn btn-logout" onClick={handleLogout}>
          Logout
        </button>
      </nav>
    </header>
  );
}
