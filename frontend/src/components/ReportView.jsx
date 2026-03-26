import { useRef } from 'react';
import { useLang } from '../context/LangContext';

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

export default function ReportView({ entry, onClose }) {
  const reportRef = useRef();
  const { t } = useLang();

  function handleDownload() {
    const content = reportRef.current;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
      <head>
        <title>${t.report} - Entry #${entry.sno}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 30px; color: #212529; }
          .report-header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #1a2744; padding-bottom: 16px; }
          .report-header h2 { color: #1a2744; font-size: 20px; margin: 0; }
          .report-header h3 { color: #0d7377; font-size: 15px; margin: 4px 0 0; }
          .report-header p { font-size: 12px; color: #6c757d; margin-top: 8px; }
          h4 { color: #1a2744; font-size: 16px; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          td { padding: 8px 12px; border: 1px solid #dee2e6; font-size: 13px; vertical-align: top; }
          td.label { background: #f8f9fa; font-weight: 600; width: 200px; color: #495057; }
          .photos { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
          .photos img { max-width: 200px; max-height: 150px; border: 1px solid #dee2e6; border-radius: 4px; }
          .sig-section { margin-top: 50px; display: flex; justify-content: space-between; gap: 40px; }
          .sig-block { flex: 1; text-align: center; }
          .sig-block .line { border-bottom: 1px solid #212529; height: 40px; margin-bottom: 6px; }
          .sig-block p { font-size: 11px; color: #495057; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        ${content.innerHTML}
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-report">
        <div className="modal-header">
          <h3>{t.entryReport} - #{entry.sno}</h3>
          <div className="modal-header-actions">
            <button className="btn btn-sm btn-primary" onClick={handleDownload}>
              {t.downloadPrint}
            </button>
            <button className="btn-close" onClick={onClose}>X</button>
          </div>
        </div>

        <div className="modal-body" ref={reportRef}>
          <div className="report-header">
            <h2>{t.portalTitle}</h2>
            <h3>{t.portalSubtitle}</h3>
            <p>{t.generatedOn}: {new Date().toLocaleDateString('en-IN', {
              day: '2-digit', month: 'long', year: 'numeric'
            })}</p>
          </div>

          <h4>{t.entryReport} #{entry.sno}</h4>
          <table>
            <tbody>
              <tr><td className="label">{t.sno}</td><td>{entry.sno}</td></tr>
              <tr><td className="label">{t.date}</td><td>{entry.entryDate}</td></tr>
              <tr><td className="label">{t.time}</td><td>{entry.entryTime}</td></tr>
              <tr><td className="label">{t.district}</td><td>{DISTRICT_NAMES[entry.districtId] || entry.districtId}</td></tr>
              <tr><td className="label">{t.assemblyConstituency}</td><td>{entry.constituency}</td></tr>
              <tr><td className="label">{t.gistOfContent}</td><td>{entry.gist}</td></tr>
              <tr><td className="label">{t.sourceOfComplaint}</td><td>{entry.sourceOfComplaint}</td></tr>
              <tr><td className="label">{t.addedBy}</td><td>{entry.addedBy || 'Admin'}</td></tr>
              <tr><td className="label">{t.newsLink}</td><td>{entry.newsLink || t.na}</td></tr>
              <tr><td className="label">{t.immediateReply}</td><td>{entry.immediateReply}</td></tr>
              <tr><td className="label">{t.repliedLink}</td><td>{entry.repliedLink ? <a href={entry.repliedLink} target="_blank" rel="noopener noreferrer">{entry.repliedLink}</a> : t.na}</td></tr>
              <tr><td className="label">{t.finalReply}</td><td>{entry.finalReply}</td></tr>
              <tr>
                <td className="label">{t.evidencePhotosLabel}</td>
                <td>
                  {entry.evidencePhotos && entry.evidencePhotos.length > 0 ? (
                    <div className="photos">
                      {entry.evidencePhotos.map((p, i) => {
                        const name = p.filename || `File ${i + 1}`;
                        const ext = name.split('.').pop().toLowerCase();
                        const isImg = ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext);
                        if (isImg) {
                          return <img key={i} src={p.url} alt={`Evidence ${i + 1}`} />;
                        }
                        return (
                          <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                            style={{ color: '#0d7377', textDecoration: 'underline' }}>{name}</a>
                        );
                      })}
                    </div>
                  ) : t.noPhotos}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="sig-section">
            <div className="sig-block">
              <div className="line"></div>
              <p>{t.districtOfficerSig}</p>
            </div>
            <div className="sig-block">
              <div className="line"></div>
              <p>{t.adminSig}</p>
            </div>
            <div className="sig-block">
              <div className="line"></div>
              <p>{t.date}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
