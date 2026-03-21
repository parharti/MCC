import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Reports() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports')
      .then(res => setEntries(res.data.entries))
      .catch(err => console.error('Failed to fetch reports:', err))
      .finally(() => setLoading(false));
  }, []);

  function handlePrint() {
    window.print();
  }

  if (loading) return <div className="loading">Loading report data...</div>;

  return (
    <div className="reports-page">
      <div className="reports-header no-print">
        <h2>Closed Entries Report</h2>
        <button className="btn btn-primary" onClick={handlePrint}>
          Print Report
        </button>
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
