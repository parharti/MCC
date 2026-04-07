import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import api from '../services/api';
import * as XLSX from 'xlsx';

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
  { value: 'custom', label: 'Custom Range', days: 0 },
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
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [rangeType, setRangeType] = useState('daily');
  const [addedByFilter, setAddedByFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('complaintId');
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const mediaTypeFilter = mediaTypeFromUrl;

  useEffect(() => {
    api.get('/entries')
      .then(res => setAllEntries(res.data.entries))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  // Filter entries by media type
  const mediaFiltered = mediaTypeFilter
    ? allEntries.filter(e => (e.mediaType || 'social_media') === mediaTypeFilter)
    : allEntries;

  // Filter entries by addedBy
  const addedByFiltered = addedByFilter === 'all'
    ? mediaFiltered
    : addedByFilter === 'admin'
      ? mediaFiltered.filter(e => (e.addedBy || 'Admin') === 'Admin')
      : mediaFiltered.filter(e => (e.addedBy || 'Admin') !== 'Admin');

  // Filter entries by status
  const entries = statusFilter === 'all'
    ? addedByFiltered
    : addedByFiltered.filter(e => e.status === statusFilter);

  const isSocialView = !mediaTypeFilter || mediaTypeFilter === 'social_media';

  let rangeStart, rangeEnd;
  if (rangeType === 'custom') {
    rangeStart = customFrom;
    rangeEnd = customTo;
  } else {
    const rangeDays = RANGE_OPTIONS.find(r => r.value === rangeType)?.days || 1;
    ({ start: rangeStart, end: rangeEnd } = getDateRange(selectedDate, rangeDays));
  }
  const rangeEntries = entries.filter(e => e.entryDate >= rangeStart && e.entryDate <= rangeEnd);

  const rangeLabel = rangeType === 'daily' ? selectedDate
    : rangeType === 'custom' ? `${customFrom} to ${customTo}`
    : `${rangeStart} to ${rangeEnd}`;

  const totalAll = entries.length;
  const totalDay = rangeEntries.length;
  const pendingDay = rangeEntries.filter(e => e.status === 'Pending').length;
  const repliedDay = rangeEntries.filter(e => e.status === 'Replied').length;
  const closedDay = rangeEntries.filter(e => e.status === 'Closed').length;
  const droppedDay = rangeEntries.filter(e => e.status === 'Dropped').length;
  const overdueDay = isSocialView
    ? rangeEntries.filter(e => e.status !== 'Closed' && e.status !== 'Dropped' && (Date.now() - new Date(e.createdAt).getTime()) >= 24*60*60*1000).length
    : 0;

  const districtWise = {};
  rangeEntries.forEach(e => {
    if (!districtWise[e.districtId]) districtWise[e.districtId] = { total: 0, pending: 0, replied: 0, closed: 0, dropped: 0 };
    districtWise[e.districtId].total++;
    if (e.status === 'Pending') districtWise[e.districtId].pending++;
    else if (e.status === 'Replied') districtWise[e.districtId].replied++;
    else if (e.status === 'Closed') districtWise[e.districtId].closed++;
    else if (e.status === 'Dropped') districtWise[e.districtId].dropped++;
  });

  const overallPending = entries.filter(e => e.status === 'Pending').length;
  const overallReplied = entries.filter(e => e.status === 'Replied').length;
  const overallClosed = entries.filter(e => e.status === 'Closed').length;
  const overallDropped = entries.filter(e => e.status === 'Dropped').length;

  function handlePrint() {
    window.print();
  }

  function handleDownloadExcel() {
    if (rangeEntries.length === 0) {
      alert('No complaints to export for the selected filters.');
      return;
    }

    const rows = [...rangeEntries].sort((a, b) => sortBy === 'date'
      ? new Date(a.entryDate + ' ' + (a.entryTime || '00:00')) - new Date(b.entryDate + ' ' + (b.entryTime || '00:00'))
      : a.sno - b.sno
    ).map(e => ({
      'S.No': e.sno,
      'Complaint ID': e.complaintId,
      'Date': e.entryDate,
      'Time': e.entryTime || '',
      'Media Type': e.mediaType === 'social_media' ? 'Social Media'
        : e.mediaType === 'print_media' ? 'Print Media'
        : e.mediaType === 'electronic_media' ? 'Electronic Media' : e.mediaType,
      'District': DISTRICT_NAMES[e.districtId] || e.districtId,
      'Constituency': e.constituency || '',
      'Gist of Content': e.gist,
      'Source of Complaint': e.sourceOfComplaint || '',
      'News Link': e.newsLink || '',
      'Added By': e.addedBy || 'Admin',
      'Status': e.status,
      'Remark': e.remark || '',
      'Immediate Reply': e.immediateReply || '',
      'Final Reply': e.finalReply || '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-width columns
    const colWidths = Object.keys(rows[0]).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String(r[key] || '').substring(0, 100).length), 10)
    }));
    ws['!cols'] = colWidths;

    const filterLabel = addedByFilter === 'all' ? 'All' : addedByFilter === 'admin' ? 'Admin' : 'District';
    const statusLabel = statusFilter === 'all' ? 'AllStatus' : statusFilter;
    const sheetName = `${rangeLabel} - ${filterLabel}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));

    const fileName = `Complaints_Report_${rangeLabel.replace(/ /g, '_')}_${filterLabel}_${statusLabel}.xlsx`;
    XLSX.writeFile(wb, fileName);
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
            <select value={addedByFilter} onChange={e => setAddedByFilter(e.target.value)} className="range-select">
              <option value="all">{t.allAddedBy}</option>
              <option value="admin">{t.addedByAdmin}</option>
              <option value="district">{t.addedByDistrict}</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="range-select">
              <option value="all">{t.allStatuses || 'All Statuses'}</option>
              <option value="Pending">{t.pending}</option>
              <option value="Replied">{t.replied}</option>
              <option value="Closed">{t.closed}</option>
              <option value="Dropped">{t.dropped}</option>
            </select>
            {rangeType === 'custom' ? (
              <>
                <label style={{ fontSize: '13px', color: '#555' }}>From:</label>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className="date-picker" />
                <label style={{ fontSize: '13px', color: '#555' }}>To:</label>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  className="date-picker" />
              </>
            ) : (
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                className="date-picker" />
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={handleDownloadExcel}>Download Excel</button>
          <button className="btn btn-primary" onClick={handlePrint}>{t.downloadPrint}</button>
        </div>
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
            <div className="rs-item rs-dropped"><span className="rs-num">{droppedDay}</span><span className="rs-label">{t.dropped}</span></div>
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
            <div className="rs-item rs-dropped"><span className="rs-num">{overallDropped}</span><span className="rs-label">{t.dropped}</span></div>
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
                  <th>{t.dropped}</th>
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
                    <td>{ds.dropped > 0 ? ds.dropped : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="report-complaints-list">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h3>Complaints ({rangeLabel}) - {rangeEntries.length} total</h3>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="range-select no-print" style={{ marginBottom: '8px' }}>
              <option value="complaintId">{t.sortByComplaintId || 'Sort by Complaint ID'}</option>
              <option value="date">{t.sortByDate || 'Sort by Date'}</option>
            </select>
          </div>
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
                  <th>{t.addedBy}</th>
                  <th>{t.status}</th>
                  {isSocialView && <th>{t.immediateReply}</th>}
                  <th>{t.finalReply}</th>
                </tr>
              </thead>
              <tbody>
                {[...rangeEntries].sort((a, b) => sortBy === 'date'
                  ? new Date(a.entryDate + ' ' + (a.entryTime || '00:00')) - new Date(b.entryDate + ' ' + (b.entryTime || '00:00'))
                  : a.sno - b.sno
                ).map(entry => (
                  <tr key={entry.id}>
                    <td>{entry.complaintId}</td>
                    <td>{DISTRICT_NAMES[entry.districtId] || entry.districtId}</td>
                    <td>{entry.gist}</td>
                    <td>{entry.sourceOfComplaint}</td>
                    <td>{entry.addedBy || 'Admin'}</td>
                    <td>
                      <span className={`badge badge-${entry.status.toLowerCase()}`}>
                        {entry.status === 'Pending' ? t.pending : entry.status === 'Replied' ? t.replied : entry.status === 'Dropped' ? t.dropped : t.closed}
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
