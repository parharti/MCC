import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import api from '../services/api';

const DISTRICT_NAMES = {
  ariyalur: 'Ariyalur', chengalpattu: 'Chengalpattu', chennai: 'Chennai',
  coimbatore: 'Coimbatore', cuddalore: 'Cuddalore', dharmapuri: 'Dharmapuri',
  dindigul: 'Dindigul', erode: 'Erode', kallakurichi: 'Kallakurichi',
  kanchipuram: 'Kanchipuram', kanyakumari: 'Kanyakumari', karur: 'Karur',
  krishnagiri: 'Krishnagiri', madurai: 'Madurai', mayiladuthurai: 'Mayiladuthurai',
  nagapattinam: 'Nagapattinam', namakkal: 'Namakkal', nilgiris: 'Nilgiris',
  perambalur: 'Perambalur', pudukkottai: 'Pudukkottai', ramanathapuram: 'Ramanathapuram',
  ranipet: 'Ranipet', salem: 'Salem', sivagangai: 'Sivagangai',
  tenkasi: 'Tenkasi', thanjavur: 'Thanjavur', theni: 'Theni',
  thoothukudi: 'Thoothukudi (Tuticorin)', tiruchirappalli: 'Tiruchirappalli',
  tirunelveli: 'Tirunelveli', tirupathur: 'Tirupathur', tiruppur: 'Tiruppur',
  tiruvallur: 'Tiruvallur', tiruvannamalai: 'Tiruvannamalai', tiruvarur: 'Tiruvarur',
  vellore: 'Vellore', viluppuram: 'Viluppuram', virudhunagar: 'Virudhunagar'
};

const MEDIA_TYPE_OPTIONS = [
  { value: '', label: 'all' },
  { value: 'social_media', label: 'socialMedia' },
  { value: 'print_media', label: 'printMedia' },
  { value: 'electronic_media', label: 'electronicMedia' },
];

const RANGE_OPTIONS = [
  { value: 'daily', label: 'Daily', days: 1 },
  { value: '2days', label: '2 Days', days: 2 },
  { value: 'weekly', label: 'Weekly', days: 7 },
];

function getDateRange(endDate, days) {
  const end = new Date(endDate);
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  return { start: start.toISOString().split('T')[0], end: endDate };
}

export default function DailyReport() {
  const { t } = useLang();
  const [searchParams] = useSearchParams();
  const mediaTypeFromUrl = searchParams.get('mediaType') || '';
  const [allEntries, setAllEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [rangeType, setRangeType] = useState('daily');
  const mediaTypeFilter = mediaTypeFromUrl;

  useEffect(() => {
    api.get('/entries')
      .then(res => setAllEntries(res.data.entries))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  // Filter entries by media type
  const entries = mediaTypeFilter
    ? allEntries.filter(e => (e.mediaType || 'social_media') === mediaTypeFilter)
    : allEntries;

  const isSocialView = !mediaTypeFilter || mediaTypeFilter === 'social_media';

  const rangeDays = RANGE_OPTIONS.find(r => r.value === rangeType)?.days || 1;
  const { start: rangeStart, end: rangeEnd } = getDateRange(selectedDate, rangeDays);
  const rangeEntries = entries.filter(e => e.entryDate >= rangeStart && e.entryDate <= rangeEnd);

  const rangeLabel = rangeType === 'daily' ? selectedDate : `${rangeStart} to ${rangeEnd}`;

  const totalAll = entries.length;
  const totalDay = rangeEntries.length;
  const pendingDay = rangeEntries.filter(e => e.status === 'Pending').length;
  const repliedDay = rangeEntries.filter(e => e.status === 'Replied').length;
  const closedDay = rangeEntries.filter(e => e.status === 'Closed').length;
  const overdueDay = isSocialView
    ? rangeEntries.filter(e => e.status !== 'Closed' && (Date.now() - new Date(e.createdAt).getTime()) >= 24*60*60*1000).length
    : 0;

  const districtWise = {};
  rangeEntries.forEach(e => {
    if (!districtWise[e.districtId]) districtWise[e.districtId] = { total: 0, pending: 0, replied: 0, closed: 0 };
    districtWise[e.districtId].total++;
    if (e.status === 'Pending') districtWise[e.districtId].pending++;
    else if (e.status === 'Replied') districtWise[e.districtId].replied++;
    else if (e.status === 'Closed') districtWise[e.districtId].closed++;
  });

  const overallPending = entries.filter(e => e.status === 'Pending').length;
  const overallReplied = entries.filter(e => e.status === 'Replied').length;
  const overallClosed = entries.filter(e => e.status === 'Closed').length;

  function handlePrint() {
    window.print();
  }

  const mediaLabel = mediaTypeFilter
    ? t[MEDIA_TYPE_OPTIONS.find(o => o.value === mediaTypeFilter)?.label] || ''
    : '';

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="daily-report">
      <div className="page-header no-print">
        <div className="page-header-left">
          <h2 className="page-title">{t.report}{mediaLabel ? ` - ${mediaLabel}` : ''}</h2>
          <div className="report-controls">
            <select value={rangeType} onChange={e => setRangeType(e.target.value)} className="range-select">
              {RANGE_OPTIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="date-picker" />
          </div>
        </div>
        <button className="btn btn-primary" onClick={handlePrint}>{t.downloadPrint}</button>
      </div>

      <div className="report-print-content">
        <div className="report-header-print">
          <h2>Media Tracker Portal</h2>
          <h3>{t.portalSubtitle}</h3>
          <p>{rangeType === 'daily' ? 'Daily' : rangeType === '2days' ? '2-Day' : 'Weekly'} Report - {rangeLabel}{mediaLabel ? ` (${mediaLabel})` : ''}</p>
        </div>

        <div className="report-summary">
          <h3>{rangeType === 'daily' ? 'Day' : 'Period'} Summary ({rangeLabel})</h3>
          <div className="report-summary-grid">
            <div className="rs-item"><span className="rs-num">{totalDay}</span><span className="rs-label">{t.totalComplaints}</span></div>
            <div className="rs-item rs-pending"><span className="rs-num">{pendingDay}</span><span className="rs-label">{t.pending}</span></div>
            {isSocialView && (
              <div className="rs-item rs-replied"><span className="rs-num">{repliedDay}</span><span className="rs-label">{t.replied}</span></div>
            )}
            <div className="rs-item rs-closed"><span className="rs-num">{closedDay}</span><span className="rs-label">{t.closed}</span></div>
            {isSocialView && (
              <div className="rs-item rs-overdue"><span className="rs-num">{overdueDay}</span><span className="rs-label">{t.overdue}</span></div>
            )}
          </div>
        </div>

        <div className="report-summary">
          <h3>Cumulative Summary (All Time){mediaLabel ? ` - ${mediaLabel}` : ''}</h3>
          <div className="report-summary-grid">
            <div className="rs-item"><span className="rs-num">{totalAll}</span><span className="rs-label">{t.totalComplaints}</span></div>
            <div className="rs-item rs-pending"><span className="rs-num">{overallPending}</span><span className="rs-label">{t.pending}</span></div>
            {isSocialView && (
              <div className="rs-item rs-replied"><span className="rs-num">{overallReplied}</span><span className="rs-label">{t.replied}</span></div>
            )}
            <div className="rs-item rs-closed"><span className="rs-num">{overallClosed}</span><span className="rs-label">{t.closed}</span></div>
          </div>
        </div>

        {Object.keys(districtWise).length > 0 && (
          <div className="report-district-table">
            <h3>District-wise Breakdown ({rangeLabel})</h3>
            <table className="report-table-full">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t.district}</th>
                  <th>{t.totalComplaints}</th>
                  <th>{t.pending}</th>
                  {isSocialView && <th>{t.replied}</th>}
                  <th>{t.closed}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(districtWise)
                  .sort((a, b) => (DISTRICT_NAMES[a[0]] || a[0]).localeCompare(DISTRICT_NAMES[b[0]] || b[0]))
                  .map(([did, ds], idx) => (
                  <tr key={did}>
                    <td>{idx + 1}</td>
                    <td>{DISTRICT_NAMES[did] || did}</td>
                    <td>{ds.total}</td>
                    <td>{ds.pending > 0 ? ds.pending : '-'}</td>
                    {isSocialView && <td>{ds.replied > 0 ? ds.replied : '-'}</td>}
                    <td>{ds.closed > 0 ? ds.closed : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="report-complaints-list">
          <h3>Complaints ({rangeLabel}) - {rangeEntries.length} total</h3>
          {rangeEntries.length === 0 ? (
            <p className="text-muted">No complaints for this period.</p>
          ) : (
            <table className="report-table-full">
              <thead>
                <tr>
                  <th>{t.complaintId}</th>
                  <th>{t.district}</th>
                  <th>{t.gistOfContent}</th>
                  <th>{t.source}</th>
                  <th>{t.status}</th>
                  {isSocialView && <th>{t.immediateReply}</th>}
                  <th>{t.finalReply}</th>
                </tr>
              </thead>
              <tbody>
                {rangeEntries.sort((a, b) => a.sno - b.sno).map(entry => (
                  <tr key={entry.id}>
                    <td>{entry.complaintId}</td>
                    <td>{DISTRICT_NAMES[entry.districtId] || entry.districtId}</td>
                    <td>{entry.gist}</td>
                    <td>{entry.sourceOfComplaint}</td>
                    <td>
                      <span className={`badge badge-${entry.status.toLowerCase()}`}>
                        {entry.status === 'Pending' ? t.pending : entry.status === 'Replied' ? t.replied : t.closed}
                      </span>
                    </td>
                    {isSocialView && <td>{entry.immediateReply || '-'}</td>}
                    <td>{entry.finalReply || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="report-signatures">
          <div className="sig-block">
            <div className="sig-line"></div>
            <p>{t.adminSig}</p>
          </div>
          <div className="sig-block">
            <div className="sig-line"></div>
            <p>{t.date}</p>
          </div>
        </div>

        <div className="no-print" style={{ textAlign: 'right', marginTop: '8px' }}>
          <button
            className="btn-backup"
            onClick={async () => {
              try {
                const res = await api.get('/entries/backup', { responseType: 'blob' });
                const url = window.URL.createObjectURL(res.data);
                const a = document.createElement('a');
                a.href = url;
                a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                window.URL.revokeObjectURL(url);
              } catch { alert('Backup failed.'); }
            }}
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
