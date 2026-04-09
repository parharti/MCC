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
  const [mediaFilter, setMediaFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');

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

  const overall = stats?.overall || { total: 0, pending: 0, replied: 0, closed: 0, dropped: 0, overdue: 0 };
  const districtStats = stats?.districtStats || {};
  const mediaTypeStats = stats?.mediaTypeStats || { social_media: { total: 0 }, print_media: { total: 0 }, electronic_media: { total: 0 } };

  // Filter and sort districts
  const filteredDistricts = Object.entries(DISTRICT_NAMES)
    .filter(([id, name]) => name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'total') {
        const getTotal = (id) => {
          const raw = districtStats[id] || {};
          if (mediaFilter) return (raw[mediaFilter] || {}).total || 0;
          return raw.total || 0;
        };
        return getTotal(b[0]) - getTotal(a[0]);
      }
      return a[1].localeCompare(b[1]);
    });

  function handleDistrictClick(districtId) {
    navigate(`/entries?district=${districtId}`);
  }

  return (
    <div className="dashboard">
      <h2 className="page-title">
        {user.role === 'admin' ? t.adminDashboard : `${user.districtName} - ${t.dashboard}`}
      </h2>

      <div className="summary-cards">
        <div className="summary-card card-total clickable" onClick={() => navigate('/entries')}>
          <div className="summary-number">{overall.total}</div>
          <div className="summary-label">{t.totalEntries}</div>
        </div>
        <div className="summary-card card-pending clickable" onClick={() => navigate('/entries?status=Pending')}>
          <div className="summary-number">{overall.pending}</div>
          <div className="summary-label">{t.pending}</div>
        </div>
        <div className="summary-card card-replied clickable" onClick={() => navigate('/entries?status=Replied')}>
          <div className="summary-number">{overall.replied}</div>
          <div className="summary-label">{t.replied}</div>
        </div>
        <div className="summary-card card-closed clickable" onClick={() => navigate('/entries?status=Closed')}>
          <div className="summary-number">{overall.closed}</div>
          <div className="summary-label">{t.closed}</div>
        </div>
        <div className="summary-card card-dropped clickable" onClick={() => navigate('/entries?status=Dropped')}>
          <div className="summary-number">{overall.dropped}</div>
          <div className="summary-label">{t.dropped}</div>
        </div>
        <div className="summary-card card-overdue clickable" onClick={() => navigate('/entries?status=Overdue')}>
          <div className="summary-number">{overall.overdue}</div>
          <div className="summary-label">{t.overdue}</div>
        </div>
      </div>

      <div className="media-type-cards">
        {[
          { key: 'social_media', label: t.socialMedia, cls: 'media-card-social' },
          { key: 'print_media', label: t.printMedia, cls: 'media-card-print' },
          { key: 'electronic_media', label: t.electronicMedia, cls: 'media-card-electronic' },
        ].map(({ key, label, cls }) => {
          const ms = mediaTypeStats[key] || {};
          return (
            <div key={key} className={`media-card ${cls}`} onClick={() => navigate(`/entries?mediaType=${key}`)}>
              <div className="summary-label" style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '8px' }}>{label}</div>
              <div className="media-stats-grid">
                <div className="media-stat-item">
                  <span className="media-stat-number">{ms.total || 0}</span>
                  <span className="media-stat-label">{t.total || 'Total'}</span>
                </div>
                <div className="media-stat-item">
                  <span className="media-stat-number" style={{ color: '#e67e22' }}>{ms.pending || 0}</span>
                  <span className="media-stat-label">{t.pending}</span>
                </div>
                <div className="media-stat-item">
                  <span className="media-stat-number" style={{ color: '#3498db' }}>{ms.replied || 0}</span>
                  <span className="media-stat-label">{t.replied}</span>
                </div>
                <div className="media-stat-item">
                  <span className="media-stat-number" style={{ color: '#27ae60' }}>{ms.closed || 0}</span>
                  <span className="media-stat-label">{t.closed}</span>
                </div>
                <div className="media-stat-item">
                  <span className="media-stat-number" style={{ color: '#6c757d' }}>{ms.dropped || 0}</span>
                  <span className="media-stat-label">{t.dropped}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {user.role === 'admin' && (
        <>
          <div className="district-list-header">
            <h3 className="section-heading">{t.districtOverview} ({filteredDistricts.length})</h3>
            <div className="district-search" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select
                value={mediaFilter}
                onChange={e => setMediaFilter(e.target.value)}
                className="search-input"
                style={{ width: 'auto' }}
              >
                <option value="">{t.allComplaints}</option>
                <option value="social_media">{t.socialMedia}</option>
                <option value="print_media">{t.printMedia}</option>
                <option value="electronic_media">{t.electronicMedia}</option>
              </select>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="search-input"
                style={{ width: 'auto' }}
              >
                <option value="name">{t.sortByName}</option>
                <option value="total">{t.sortByTotal}</option>
              </select>
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
                  <th>{t.dropped}</th>
                  <th>{t.overdue}</th>
                  <th>{t.progress}</th>
                </tr>
              </thead>
              <tbody>
                {filteredDistricts.map(([id, name], idx) => {
                  const raw = districtStats[id] || {};
                  // When media filter active, use that media type's stats; otherwise use overall
                  const ds = mediaFilter
                    ? (raw[mediaFilter] || { total: 0, pending: 0, replied: 0, closed: 0, dropped: 0, overdue: 0 })
                    : { total: raw.total || 0, pending: raw.pending || 0, replied: raw.replied || 0, closed: raw.closed || 0, dropped: raw.dropped || 0, overdue: raw.overdue || 0 };
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
                      <td className="dt-pending">{ds.pending > 0 ? ds.pending : '-'}</td>
                      <td className="dt-replied">{ds.replied > 0 ? ds.replied : '-'}</td>
                      <td className="dt-closed">{ds.closed > 0 ? ds.closed : '-'}</td>
                      <td className="dt-dropped">{ds.dropped > 0 ? ds.dropped : '-'}</td>
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
                    <td colSpan="9" className="district-row-empty">
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
