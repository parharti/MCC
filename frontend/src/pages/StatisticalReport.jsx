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

const MEDIA_LABELS = {
  '': 'All Media',
  social_media: 'Social Media',
  print_media: 'Print Media',
  electronic_media: 'Electronic Media',
};

const CATEGORY_ORDER = [
  'MCC Violation', 'Negative News', 'Fake News',
  'Paid News', 'Voter Assistance', 'Misinformation'
];

function pct(num, total) {
  if (!total) return '0.0';
  return ((num / total) * 100).toFixed(1);
}

function daysBetween(from, to) {
  if (!from || !to) return 0;
  const a = new Date(from);
  const b = new Date(to);
  return Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1);
}

export default function StatisticalReport() {
  const { t } = useLang();
  const [searchParams] = useSearchParams();
  const mediaTypeFromUrl = searchParams.get('mediaType') || '';
  const [mediaType, setMediaType] = useState(mediaTypeFromUrl);
  const today = new Date().toISOString().split('T')[0];
  const thirtyAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; })();
  const [from, setFrom] = useState(thirtyAgo);
  const [to, setTo] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMediaType(mediaTypeFromUrl);
  }, [mediaTypeFromUrl]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (mediaType) params.set('mediaType', mediaType);
    setLoading(true);
    api.get(`/entries/statistical-report?${params.toString()}`)
      .then(res => setData(res.data))
      .catch(err => console.error('Statistical report error:', err))
      .finally(() => setLoading(false));
  }, [from, to, mediaType]);

  if (loading) return <div className="loading">Loading statistical report...</div>;
  if (!data) return <div className="loading">No data.</div>;

  const { overall, categories, districts, daily } = data;
  const totalDays = daysBetween(from, to);
  const actionTaken = (overall.closed || 0) + (overall.replied || 0);
  const resolutionRate = overall.total ? ((actionTaken / overall.total) * 100).toFixed(0) : 0;
  const avgPerDay = overall.total ? (overall.total / totalDays).toFixed(1) : '0.0';
  const peakDay = daily.reduce((p, d) => (d.total > (p?.total || 0) ? d : p), null);
  const daysWithAction = daily.filter(d => d.closed + d.replied > 0).length;
  const totalPendingAcrossDays = daily.reduce((s, d) => s + (d.pending || 0), 0);
  const maxPendingAvg = daily.length ? (totalPendingAcrossDays / daily.length).toFixed(1) : '0.0';

  const topDistricts = [...districts].slice(0, 10);
  const rangeLabel = `${from} to ${to}`;
  const mediaLabel = MEDIA_LABELS[mediaType] || 'All Media';

  function handlePrint() { window.print(); }

  function handleDownloadExcel() {
    const wb = XLSX.utils.book_new();

    const summary = [
      { Metric: 'Report Period', Value: rangeLabel },
      { Metric: 'Media Type', Value: mediaLabel },
      { Metric: 'Total Complaints', Value: overall.total },
      { Metric: 'Action Taken (Closed + Replied)', Value: actionTaken },
      { Metric: 'Pending', Value: overall.pending },
      { Metric: 'Dropped', Value: overall.dropped },
      { Metric: 'Resolution Rate (%)', Value: resolutionRate },
      { Metric: 'Districts Covered', Value: overall.districtCount },
      { Metric: 'Admin Uploaded', Value: overall.addedByAdmin },
      { Metric: 'District Uploaded', Value: overall.addedByDistrict },
      { Metric: 'Days Monitored', Value: totalDays },
      { Metric: 'Peak Day', Value: peakDay ? `${peakDay.date} (${peakDay.total})` : '-' },
      { Metric: 'Average per Day', Value: avgPerDay },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');

    const catRows = Object.entries(categories).map(([cat, c]) => ({
      Category: cat, Total: c.total, Closed: c.closed,
      Replied: c.replied, Pending: c.pending, Dropped: c.dropped,
      'Share (%)': pct(c.total, overall.total)
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catRows), 'By Category');

    const distRows = districts.map(d => ({
      District: DISTRICT_NAMES[d.districtId] || d.districtId,
      Total: d.total, 'MCC Violation': d.mcc, 'Negative News': d.negative,
      'Fake News': d.fake, 'Paid News': d.paid,
      'Voter Assistance': d.voter, 'Misinformation': d.misinfo,
      Closed: d.closed, Replied: d.replied, Pending: d.pending, Dropped: d.dropped
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(distRows), 'By District');

    const dayRows = daily.map(d => ({
      Date: d.date, Total: d.total, MCC: d.mcc, Negative: d.negative,
      Closed: d.closed, Replied: d.replied, Pending: d.pending, Dropped: d.dropped
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dayRows), 'Daily Trend');

    XLSX.writeFile(wb, `Statistical_Report_${from}_to_${to}_${mediaLabel.replace(/ /g, '_')}.xlsx`);
  }

  const mccTotal = categories['MCC Violation']?.total || 0;
  const negTotal = categories['Negative News']?.total || 0;
  const paidTotal = categories['Paid News']?.total || 0;
  const fakeTotal = categories['Fake News']?.total || 0;
  const voterTotal = categories['Voter Assistance']?.total || 0;
  const misinfoTotal = categories['Misinformation']?.total || 0;

  return (
    <div className="daily-report">
      <div className="page-header no-print">
        <div className="page-header-left">
          <h2 className="page-title">{t.statisticalReport || 'Statistical Report'}</h2>
          <div className="report-controls">
            <label style={{ fontSize: '13px', color: '#555' }}>From:</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="date-picker" />
            <label style={{ fontSize: '13px', color: '#555' }}>To:</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="date-picker" />
            <select value={mediaType} onChange={e => setMediaType(e.target.value)} className="range-select">
              <option value="">{t.allMedia || 'All Media'}</option>
              <option value="social_media">{t.socialMedia}</option>
              <option value="print_media">{t.printMedia}</option>
              <option value="electronic_media">{t.electronicMedia}</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={handleDownloadExcel}>Download Excel</button>
          <button className="btn btn-primary" onClick={handlePrint}>{t.downloadPrint || 'Print'}</button>
        </div>
      </div>

      <div className="report-print-content">
        <div className="report-header-print">
          <h2>Election Commission of India</h2>
          <h3>{t.portalSubtitle || 'Tamil Nadu'} — Complaints Statistical Report</h3>
          <p>{rangeLabel} &nbsp;|&nbsp; {mediaLabel}</p>
        </div>

        <div className="report-summary">
          <h3>Key Metrics Overview</h3>
          <div className="report-summary-grid">
            <div className="rs-item">
              <span className="rs-num">{overall.total}</span>
              <span className="rs-label">Total Complaints</span>
            </div>
            <div className="rs-item rs-closed">
              <span className="rs-num">{actionTaken}</span>
              <span className="rs-label">Action Taken ({resolutionRate}%)</span>
            </div>
            <div className="rs-item rs-pending">
              <span className="rs-num">{overall.pending}</span>
              <span className="rs-label">Pending ({pct(overall.pending, overall.total)}%)</span>
            </div>
            <div className="rs-item rs-dropped">
              <span className="rs-num">{overall.dropped}</span>
              <span className="rs-label">Dropped</span>
            </div>
            <div className="rs-item">
              <span className="rs-num">{overall.districtCount}</span>
              <span className="rs-label">Districts</span>
            </div>
            <div className="rs-item">
              <span className="rs-num">{totalDays}</span>
              <span className="rs-label">Days Monitored</span>
            </div>
          </div>
        </div>

        <div className="report-summary">
          <h3>Source of Complaints</h3>
          <div className="report-summary-grid">
            <div className="rs-item">
              <span className="rs-num">{overall.addedByAdmin}</span>
              <span className="rs-label">Admin Uploaded ({pct(overall.addedByAdmin, overall.total)}%)</span>
            </div>
            <div className="rs-item">
              <span className="rs-num">{overall.addedByDistrict}</span>
              <span className="rs-label">District Uploaded ({pct(overall.addedByDistrict, overall.total)}%)</span>
            </div>
          </div>
        </div>

        <div className="report-summary">
          <h3>Category Highlights</h3>
          <div className="report-summary-grid">
            <div className="rs-item"><span className="rs-num">{mccTotal}</span><span className="rs-label">MCC Violation ({pct(mccTotal, overall.total)}%)</span></div>
            <div className="rs-item"><span className="rs-num">{negTotal}</span><span className="rs-label">Negative News ({pct(negTotal, overall.total)}%)</span></div>
            <div className="rs-item"><span className="rs-num">{fakeTotal}</span><span className="rs-label">Fake News ({pct(fakeTotal, overall.total)}%)</span></div>
            <div className="rs-item"><span className="rs-num">{paidTotal}</span><span className="rs-label">Paid News ({pct(paidTotal, overall.total)}%)</span></div>
            <div className="rs-item"><span className="rs-num">{voterTotal}</span><span className="rs-label">Voter Assistance ({pct(voterTotal, overall.total)}%)</span></div>
            <div className="rs-item"><span className="rs-num">{misinfoTotal}</span><span className="rs-label">Misinformation ({pct(misinfoTotal, overall.total)}%)</span></div>
          </div>
        </div>

        <div className="report-summary">
          <h3>Date-wise Complaint Trend</h3>
          <div className="report-summary-grid">
            <div className="rs-item">
              <span className="rs-num">{peakDay ? peakDay.total : 0}</span>
              <span className="rs-label">Peak Day{peakDay ? ` — ${peakDay.date}` : ''}</span>
            </div>
            <div className="rs-item">
              <span className="rs-num">{avgPerDay}</span>
              <span className="rs-label">Avg per Day</span>
            </div>
            <div className="rs-item">
              <span className="rs-num">{daysWithAction}/{daily.length}</span>
              <span className="rs-label">Days with Action</span>
            </div>
            <div className="rs-item">
              <span className="rs-num">{maxPendingAvg}</span>
              <span className="rs-label">Avg Pending / Day</span>
            </div>
          </div>
        </div>

        <div className="report-district-table">
          <h3>Category Results Matrix</h3>
          <table className="report-table-full">
            <thead>
              <tr>
                <th>Category</th>
                <th>Total</th>
                <th>Closed</th>
                <th>Replied</th>
                <th>Pending</th>
                <th>Dropped</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORY_ORDER.map(cat => {
                const c = categories[cat] || { total: 0, closed: 0, replied: 0, pending: 0, dropped: 0 };
                if (!c.total) return null;
                return (
                  <tr key={cat}>
                    <td>{cat}</td>
                    <td>{c.total}</td>
                    <td>{c.closed}</td>
                    <td>{c.replied}</td>
                    <td>{c.pending}</td>
                    <td>{c.dropped}</td>
                    <td>{pct(c.total, overall.total)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="report-district-table">
          <h3>District-wise Breakdown (Top {topDistricts.length})</h3>
          <table className="report-table-full">
            <thead>
              <tr>
                <th>#</th>
                <th>District</th>
                <th>Total</th>
                <th>MCC</th>
                <th>Neg</th>
                <th>Closed</th>
                <th>Pending</th>
              </tr>
            </thead>
            <tbody>
              {topDistricts.map((d, idx) => (
                <tr key={d.districtId}>
                  <td>{idx + 1}</td>
                  <td>{DISTRICT_NAMES[d.districtId] || d.districtId}</td>
                  <td>{d.total}</td>
                  <td>{d.mcc}</td>
                  <td>{d.negative}</td>
                  <td>{d.closed}</td>
                  <td>{d.pending || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="report-summary">
          <h3>Summary</h3>
          <ol style={{ lineHeight: '1.8', paddingLeft: '20px' }}>
            <li>{overall.total} complaints received over {totalDays} days ({rangeLabel}) across {overall.districtCount} districts.</li>
            <li>{resolutionRate}% action rate — {actionTaken} complaints resolved (Closed + Replied). {overall.pending} remain pending.</li>
            {mccTotal > 0 && (
              <li>MCC Violations dominate at {mccTotal} ({pct(mccTotal, overall.total)}%){negTotal > 0 ? `, followed by Negative News at ${negTotal} (${pct(negTotal, overall.total)}%)` : ''}.</li>
            )}
            {topDistricts.length > 0 && (
              <li>
                {DISTRICT_NAMES[topDistricts[0].districtId] || topDistricts[0].districtId} leads with {topDistricts[0].total} complaints
                {topDistricts[1] ? `; ${DISTRICT_NAMES[topDistricts[1].districtId] || topDistricts[1].districtId} (${topDistricts[1].total})` : ''}
                {topDistricts[2] ? ` and ${DISTRICT_NAMES[topDistricts[2].districtId] || topDistricts[2].districtId} (${topDistricts[2].total}) follow` : ''}.
              </li>
            )}
            <li>Admin uploaded {overall.addedByAdmin} ({pct(overall.addedByAdmin, overall.total)}%); Districts contributed {overall.addedByDistrict} ({pct(overall.addedByDistrict, overall.total)}%).</li>
          </ol>
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
