import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Reports() {
  const [allEntries, setAllEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addedByFilter, setAddedByFilter] = useState('all');

  useEffect(() => {
    api.get('/reports')
      .then(res => setAllEntries(res.data.entries))
      .catch(err => console.error('Failed to fetch reports:', err))
      .finally(() => setLoading(false));
  }, []);

  const entries = addedByFilter === 'all'
    ? allEntries
    : addedByFilter === 'admin'
      ? allEntries.filter(e => (e.addedBy || 'Admin') === 'Admin')
      : allEntries.filter(e => (e.addedBy || 'Admin') !== 'Admin');

  function handlePrint() {
    window.print();
  }

  function handleDownloadExcel() {
    api.get('/reports/download-excel', { responseType: 'blob' })
      .then(res => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'All_Complaints_Report.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch(err => {
        console.error('Excel download failed:', err);
        alert('Failed to download Excel report.');
      });
  }

  if (loading) return <div className="loading">Loading report data...</div>;

  return (
    <div className="reports-page">
      <div className="reports-header no-print">
        <h2>Closed Entries Report</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select value={addedByFilter} onChange={e => setAddedByFilter(e.target.value)}
            className="range-select" style={{ padding: '6px 10px', borderRadius: '6px' }}>
            <option value="all">All</option>
            <option value="admin">Added by Admin</option>
            <option value="district">Added by District</option>
          </select>
          <button className="btn btn-primary" onClick={handleDownloadExcel}>
            Download Excel
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>
            Print Report
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">No closed entries to report.</div>
      ) : (
        <div className="report-content">
          <div className="report-title print-only">
            <h2>Media Tracker Portal</h2>
            <h3>Election Commission, Tamil Nadu - Closed Entries Report</h3>
            <p>Generated on: {new Date().toLocaleDateString('en-IN', {
              day: '2-digit', month: 'long', year: 'numeric'
            })}</p>
          </div>

          {entries.map((entry, idx) => (
            <div key={entry.id} className="report-entry">
              <h4>Entry #{entry.sno}</h4>
              <table className="report-table">
                <tbody>
                  <tr><td className="label">S.No</td><td>{entry.sno}</td></tr>
                  <tr><td className="label">Date</td><td>{entry.entryDate}</td></tr>
                  <tr><td className="label">Time</td><td>{entry.entryTime}</td></tr>
                  <tr><td className="label">District</td><td>{entry.districtId}</td></tr>
                  <tr><td className="label">Assembly Constituency</td><td>{entry.constituency}</td></tr>
                  <tr><td className="label">Gist of Content</td><td>{entry.gist}</td></tr>
                  <tr><td className="label">Source of Complaint</td><td>{entry.sourceOfComplaint}</td></tr>
                  <tr><td className="label">Added By</td><td>{entry.addedBy || 'Admin'}</td></tr>
                  <tr>
                    <td className="label">News Link</td>
                    <td>{entry.newsLink || 'N/A'}</td>
                  </tr>
                  <tr><td className="label">Remark</td><td>{entry.remark || 'N/A'}</td></tr>
                  <tr><td className="label">Immediate Reply</td><td>{entry.immediateReply}</td></tr>
                  <tr><td className="label">Final Reply</td><td>{entry.finalReply}</td></tr>
                  <tr>
                    <td className="label">Evidence Photos</td>
                    <td>
                      {entry.evidencePhotos && entry.evidencePhotos.length > 0 ? (
                        <div className="report-photos">
                          {entry.evidencePhotos.map((p, i) => (
                            <img key={i} src={p.url} alt={`Evidence ${i + 1}`}
                              className="report-photo" />
                          ))}
                        </div>
                      ) : 'No photos'}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="signature-section">
                <div className="signature-line">
                  <div className="sig-block">
                    <div className="sig-line"></div>
                    <p>District Officer Signature</p>
                  </div>
                  <div className="sig-block">
                    <div className="sig-line"></div>
                    <p>Admin / Supervisory Officer</p>
                  </div>
                  <div className="sig-block">
                    <div className="sig-line"></div>
                    <p>Date</p>
                  </div>
                </div>
              </div>

              {idx < entries.length - 1 && <hr className="report-divider" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
