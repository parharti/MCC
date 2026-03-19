import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import api from '../services/api';

const DISTRICT_NAMES = {
  ariyalur: 'Ariyalur',
  chengalpattu: 'Chengalpattu',
  chennai: 'Chennai',
  coimbatore: 'Coimbatore',
  cuddalore: 'Cuddalore',
  dharmapuri: 'Dharmapuri',
  dindigul: 'Dindigul',
  erode: 'Erode',
  kallakurichi: 'Kallakurichi',
  kanchipuram: 'Kanchipuram',
  kanyakumari: 'Kanyakumari',
  karur: 'Karur',
  krishnagiri: 'Krishnagiri',
  madurai: 'Madurai',
  mayiladuthurai: 'Mayiladuthurai',
  nagapattinam: 'Nagapattinam',
  namakkal: 'Namakkal',
  nilgiris: 'Nilgiris',
  perambalur: 'Perambalur',
  pudukkottai: 'Pudukkottai',
  ramanathapuram: 'Ramanathapuram',
  ranipet: 'Ranipet',
  salem: 'Salem',
  sivagangai: 'Sivagangai',
  tenkasi: 'Tenkasi',
  thanjavur: 'Thanjavur',
  theni: 'Theni',
  thoothukudi: 'Thoothukudi (Tuticorin)',
  tiruchirappalli: 'Tiruchirappalli',
  tirunelveli: 'Tirunelveli',
  tirupathur: 'Tirupathur',
  tiruppur: 'Tiruppur',
  tiruvallur: 'Tiruvallur',
  tiruvannamalai: 'Tiruvannamalai',
  tiruvarur: 'Tiruvarur',
  vellore: 'Vellore',
  viluppuram: 'Viluppuram',
  virudhunagar: 'Virudhunagar'
};

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    function fetchStats() {
      api.get('/entries/stats')
        .then(res => setStats(res.data))
        .catch(err => console.error('Stats error:', err))
        .finally(() => setLoading(false));
    }

    fetchStats();

    // Poll every 30 seconds
    const interval = setInterval(fetchStats, 30000);

    // Refresh when tab becomes visible again
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        fetchStats();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  if (loading) return <div className="loading">Loading dashboard...</div>;

  const overall = stats?.overall || { total: 0, pending: 0, replied: 0, closed: 0, overdue: 0 };
  const districtStats = stats?.districtStats || {};

  // Filter districts by search
  const filteredDistricts = Object.entries(DISTRICT_NAMES).filter(([id, name]) =>
    name.toLowerCase().includes(search.toLowerCase())
  );

  function handleDistrictClick(districtId) {
    navigate(`/entries?district=${districtId}`);
  }

  return (
    <div className="dashboard">
      <h2 className="page-title">
        {user.role === 'admin' ? t.adminDashboard : `${user.districtName} - ${t.dashboard}`}
      </h2>

      <div className="summary-cards">
        <div className="summary-card card-total">
          <div className="summary-number">{overall.total}</div>
          <div className="summary-label">{t.totalEntries}</div>
        </div>
        <div className="summary-card card-pending">
          <div className="summary-number">{overall.pending}</div>
          <div className="summary-label">{t.pending}</div>
        </div>
        <div className="summary-card card-replied">
          <div className="summary-number">{overall.replied}</div>
          <div className="summary-label">{t.replied}</div>
        </div>
        <div className="summary-card card-closed">
          <div className="summary-number">{overall.closed}</div>
          <div className="summary-label">{t.closed}</div>
        </div>
        <div className="summary-card card-overdue">
          <div className="summary-number">{overall.overdue}</div>
          <div className="summary-label">{t.overdue}</div>
        </div>
      </div>

      {user.role === 'admin' && (
        <>
          <div className="district-list-header">
            <h3 className="section-heading">{t.districtOverview} ({filteredDistricts.length})</h3>
            <div className="district-search">
              <input
                type="text"
                placeholder={t.searchDistrict}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          <div className="district-list">
            <table className="district-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t.district}</th>
                  <th>{t.total}</th>
                  <th>{t.pending}</th>
                  <th>{t.replied}</th>
                  <th>{t.closed}</th>
                  <th>{t.overdue}</th>
                  <th>{t.progress}</th>
                </tr>
              </thead>
              <tbody>
                {filteredDistricts.map(([id, name], idx) => {
                  const ds = districtStats[id] || { total: 0, pending: 0, replied: 0, closed: 0, overdue: 0 };
                  const pct = ds.total > 0 ? Math.round((ds.closed / ds.total) * 100) : 0;
                  const hasOverdue = ds.overdue > 0;

                  return (
                    <tr
                      key={id}
                      className={hasOverdue ? 'district-row-alert' : ''}
                      onClick={() => handleDistrictClick(id)}
                    >
                      <td>{idx + 1}</td>
                      <td>
                        {name}
                        {hasOverdue && <span className="overdue-dot-inline"></span>}
                      </td>
                      <td className="dt-total">{ds.total}</td>
                      <td className="dt-pending">{ds.pending}</td>
                      <td className="dt-replied">{ds.replied}</td>
                      <td className="dt-closed">{ds.closed}</td>
                      <td className="dt-overdue">{ds.overdue > 0 ? ds.overdue : '-'}</td>
                      <td>
                        <div className="dt-progress-cell">
                          <div className="dt-progress-bar">
                            <div className="dt-progress-fill" style={{ width: `${pct}%` }}></div>
                          </div>
                          <span className="dt-progress-text">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredDistricts.length === 0 && (
                  <tr>
                    <td colSpan="8" className="district-row-empty">
                      {t.noDistrictFound} "{search}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {user.role === 'district' && (
        <div className="district-officer-summary">
          <h3 className="section-heading">{t.yourDistrictStatus}</h3>
          <div className="do-info-card">
            <p>{t.youHave} <strong>{overall.pending}</strong> {t.pendingAwaitingReply}</p>
            <p>{t.youHave} <strong>{overall.replied}</strong> {t.awaitingFinalReply}</p>
            {overall.overdue > 0 && (
              <p className="do-overdue-msg">
                {overall.overdue} {t.overdueMessage}
              </p>
            )}
            {overall.total === 0 && <p>{t.noEntriesAssigned}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
