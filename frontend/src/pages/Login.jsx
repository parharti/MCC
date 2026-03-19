import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import api from '../services/api';

export default function Login() {
  const [role, setRole] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [password, setPassword] = useState('');
  const [districts, setDistricts] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/districts').then(res => {
      if (Array.isArray(res.data.districts)) setDistricts(res.data.districts);
    }).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (!role) { setError(t.selectRoleError); return; }
      if (role === 'district' && !districtId) { setError(t.selectDistrictError); return; }
      if (!password) { setError(t.enterPasswordError); return; }

      await login(role, role === 'district' ? districtId : null, password);
      navigate('/dashboard');
    } catch (err) {
      const errMsg = err.response?.data?.error;
      setError(typeof errMsg === 'string' ? errMsg : t.loginFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h2>{t.portalTitle}</h2>
          <h3>{t.portalSubtitle}</h3>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-msg">{error}</div>}

          <div className="form-group">
            <label>{t.selectRole}</label>
            <select
              value={role}
              onChange={e => { setRole(e.target.value); setDistrictId(''); setPassword(''); }}
            >
              <option value="">-- {t.selectRole} --</option>
              <option value="admin">{t.admin}</option>
              <option value="district">{t.districtOfficer}</option>
            </select>
          </div>

          {role === 'district' && (
            <div className="form-group">
              <label>{t.selectDistrict}</label>
              <select value={districtId} onChange={e => setDistrictId(e.target.value)}>
                <option value="">-- {t.selectDistrict} --</option>
                {districts.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {role && (
            <div className="form-group">
              <label>{t.password}</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t.enterPassword}
                />
                <button
                  type="button"
                  className="btn-eye"
                  onClick={() => setShowPassword(prev => !prev)}
                  title={showPassword ? t.hidePassword : t.showPassword}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
            {submitting ? t.loggingIn : t.login}
          </button>
        </form>
      </div>
    </div>
  );
}
