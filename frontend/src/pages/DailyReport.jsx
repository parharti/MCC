import { useState, useEffect } from 'react';
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

export default function DailyReport() {
  const { t } = useLang();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    api.get('/entries')
      .then(res => setEntries(res.data.entries))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const dayEntries = entries.filter(e => e.entryDate === selectedDate);

  const totalAll = entries.length;
  const totalDay = dayEntries.length;
  const pendingDay = dayEntries.filter(e => e.status === 'Pending').length;
  const repliedDay = dayEntries.filter(e => e.status === 'Replied').length;
  const closedDay = dayEntries.filter(e => e.status === 'Closed').length;
  const overdueDay = dayEntries.filter(e => e.status !== 'Closed' && (Date.now() - new Date(e.createdAt).getTime()) >= 24*60*60*1000).length;

  const districtWise = {};
  dayEntries.forEach(e => {
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

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="daily-report">
      <div className="page-header no-print">
        <div className="page-header-left">
          <h2 className="page-title">{t.report}</h2>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="date-picker" />
        </div>
        <button className="btn btn-primary" onClick={handlePrint}>{t.downloadPrint}</button>
      </div>

      <div className="report-print-content">
        <div className="report-header-print">
          <h2>MCC Violation Tracking Portal</h2>
          <h3>{t.portalSubtitle}</h3>
          <p>Daily Report - {selectedDate}</p>
        </div>

        <div className="report-summary">
          <h3>Day Summary ({selectedDate})</h3>
          <div className="report-summary-grid">
            <div className="rs-item"><span className="rs-num">{totalDay}</span><span className="rs-label">{t.totalComplaints}</span></div>
            <div className="rs-item rs-pending"><span className="rs-num">{pendingDay}</span><span className="rs-label">{t.pending}</span></div>
            <div className="rs-item rs-replied"><span className="rs-num">{repliedDay}</span><span className="rs-label">{t.replied}</span></div>
            <div className="rs-item rs-closed"><span className="rs-num">{closedDay}</span><span className="rs-label">{t.closed}</span></div>
            <div className="rs-item rs-overdue"><span className="rs-num">{overdueDay}</span><span className="rs-label">{t.overdue}</span></div>
          </div>
        </div>

        <div className="report-summary">
          <h3>Cumulative Summary (All Time)</h3>
          <div className="report-summary-grid">
            <div className="rs-item"><span className="rs-num">{totalAll}</span><span className="rs-label">{t.totalComplaints}</span></div>
            <div className="rs-item rs-pending"><span className="rs-num">{overallPending}</span><span className="rs-label">{t.pending}</span></div>
            <div className="rs-item rs-replied"><span className="rs-num">{overallReplied}</span><span className="rs-label">{t.replied}</span></div>
            <div className="rs-item rs-closed"><span className="rs-num">{overallClosed}</span><span className="rs-label">{t.closed}</span></div>
          </div>
        </div>

        {Object.keys(districtWise).length > 0 && (
          <div className="report-district-table">
            <h3>District-wise Breakdown ({selectedDate})</h3>
            <table className="report-table-full">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t.district}</th>
                  <th>{t.totalComplaints}</th>
                  <th>{t.pending}</th>
                  <th>{t.replied}</th>
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
                    <td>{ds.replied > 0 ? ds.replied : '-'}</td>
                    <td>{ds.closed > 0 ? ds.closed : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="report-complaints-list">
          <h3>Complaints ({selectedDate}) - {dayEntries.length} total</h3>
          {dayEntries.length === 0 ? (
            <p className="text-muted">No complaints for this date.</p>
          ) : (
            <table className="report-table-full">
              <thead>
                <tr>
                  <th>{t.complaintId}</th>
                  <th>{t.district}</th>
                  <th>{t.gistOfContent}</th>
                  <th>{t.source}</th>
                  <th>{t.status}</th>
                  <th>{t.immediateReply}</th>
                  <th>{t.finalReply}</th>
                </tr>
              </thead>
              <tbody>
                {dayEntries.sort((a, b) => a.sno - b.sno).map(entry => (
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
                    <td>{entry.immediateReply || '-'}</td>
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
      </div>
    </div>
  );
}
