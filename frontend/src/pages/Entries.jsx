import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import EntryForm from '../components/EntryForm';
import EntryTable from '../components/EntryTable';
import ReplyModal from '../components/ReplyModal';
import ConstituencyModal from '../components/ConstituencyModal';
import ExcelUploadModal from '../components/ExcelUploadModal';

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

const MEDIA_TYPE_LABELS = {
  social_media: 'socialMedia',
  print_media: 'printMedia',
  electronic_media: 'electronicMedia',
};

export default function Entries() {
  const { user } = useAuth();
  const { t } = useLang();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const districtFilter = searchParams.get('district');
  const mediaType = searchParams.get('mediaType');
  const statusFromUrl = searchParams.get('status');

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [replyModal, setReplyModal] = useState(null);
  const [constituencyModal, setConstituencyModal] = useState(null);
  const [showExcelUpload, setShowExcelUpload] = useState(false);
  const [evidenceModal, setEvidenceModal] = useState(null);
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [statusFilter, setStatusFilter] = useState(statusFromUrl || 'all');

  const fetchEntries = useCallback(async () => {
    try {
      setEntries([]);
      setLoading(true);
      const params = new URLSearchParams();
      if (districtFilter) params.set('districtId', districtFilter);
      if (mediaType) params.set('mediaType', mediaType);
      const qs = params.toString();
      const url = qs ? `/entries?${qs}` : '/entries';
      const res = await api.get(url);
      setEntries(res.data.entries);
    } catch (err) {
      console.error('Failed to fetch entries:', err);
    } finally {
      setLoading(false);
    }
  }, [districtFilter, mediaType]);

  useEffect(() => {
    setStatusFilter(statusFromUrl || 'all');
    fetchEntries();
  }, [fetchEntries]);

  async function handleDelete(id) {
    if (!window.confirm(t.confirmDelete)) return;
    try {
      await api.delete(`/entries/${id}`);
      fetchEntries();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete entry.');
    }
  }

  function handleEntryCreated() {
    setShowEntryForm(false);
    setEditEntry(null);
    fetchEntries();
  }

  function handleReplySubmitted() {
    setReplyModal(null);
    fetchEntries();
  }

  async function handleEvidenceUpload() {
    if (evidenceFiles.length === 0) return;
    setEvidenceUploading(true);
    try {
      const formData = new FormData();
      for (const file of evidenceFiles) {
        formData.append('photos', file);
      }
      await api.put(`/entries/${evidenceModal.id}/add-evidence`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      setEvidenceModal(null);
      setEvidenceFiles([]);
      fetchEntries();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to upload evidence.');
    } finally {
      setEvidenceUploading(false);
    }
  }

  function clearFilter() {
    if (mediaType) {
      navigate(`/entries?mediaType=${mediaType}`);
    } else {
      navigate('/entries');
    }
  }

  // Determine if this is a non-social media type (simplified workflow)
  const isSocialMedia = !mediaType || mediaType === 'social_media';

  // Status filters - hide Overdue for print/electronic media
  const statusFilters = isSocialMedia
    ? ['all', 'Pending', 'Replied', 'Closed', 'Overdue']
    : ['all', 'Pending', 'Closed'];

  const mediaLabel = mediaType && MEDIA_TYPE_LABELS[mediaType] ? t[MEDIA_TYPE_LABELS[mediaType]] : null;

  const pageTitle = districtFilter
    ? `${DISTRICT_NAMES[districtFilter] || districtFilter} - ${mediaLabel || t.entries}`
    : mediaLabel
      ? `${mediaLabel} - ${t.entries}`
      : user.role === 'admin'
        ? t.allEntries
        : `${user.districtName} - ${t.entries}`;

  return (
    <div className="entries-page">
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">{pageTitle}</h2>
          {districtFilter && (
            <button className="btn btn-sm btn-secondary" onClick={clearFilter}>
              {t.showAllDistricts}
            </button>
          )}
        </div>
        <div className="header-actions">
          {user.role === 'admin' && (
            <button className="btn btn-secondary" onClick={() => setShowExcelUpload(true)}>
              {t.uploadExcel}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowEntryForm(true)}>
            {t.addEntry}
          </button>
        </div>
      </div>

      <div className="filter-bar">
        {statusFilters.map(f => (
          <button
            key={f}
            className={`filter-btn ${statusFilter === f ? 'filter-active' : ''} ${f !== 'all' ? 'filter-' + f.toLowerCase() : ''}`}
            onClick={() => setStatusFilter(f)}
          >
            {f === 'all' ? t.total : f === 'Overdue' ? t.overdue : t[f.toLowerCase()]}
          </button>
        ))}
      </div>

      {showExcelUpload && (
        <ExcelUploadModal
          onClose={() => setShowExcelUpload(false)}
          onUploaded={fetchEntries}
          mediaType={mediaType || 'social_media'}
        />
      )}

      {(showEntryForm || editEntry) && (
        <EntryForm
          onClose={() => { setShowEntryForm(false); setEditEntry(null); }}
          onCreated={handleEntryCreated}
          defaultMediaType={mediaType || 'social_media'}
          editEntry={editEntry}
        />
      )}

      {replyModal && (
        <ReplyModal
          entry={replyModal}
          onClose={() => setReplyModal(null)}
          onSubmitted={handleReplySubmitted}
        />
      )}

      {evidenceModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Add Evidence - {evidenceModal.complaintId}</h3>
              <button className="btn-close" onClick={() => { setEvidenceModal(null); setEvidenceFiles([]); }}>X</button>
            </div>
            <div className="modal-entry-info">
              <p><strong>Gist:</strong> {evidenceModal.gist}</p>
              <p><strong>Status:</strong> {evidenceModal.status}</p>
              {evidenceModal.evidencePhotos?.length > 0 && (
                <p><strong>Existing evidence:</strong> {evidenceModal.evidencePhotos.length} file(s)</p>
              )}
            </div>
            <div className="form-group">
              <label>Select Evidence Files (Photos/PDF/Docs) *</label>
              <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.odt"
                onChange={e => setEvidenceFiles(Array.from(e.target.files))} />
              {evidenceFiles.length > 0 && <p className="file-count">{evidenceFiles.length} file(s) selected</p>}
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => { setEvidenceModal(null); setEvidenceFiles([]); }}>Cancel</button>
              <button className="btn btn-primary" disabled={evidenceUploading || evidenceFiles.length === 0} onClick={handleEvidenceUpload}>
                {evidenceUploading ? 'Uploading...' : 'Upload Evidence'}
              </button>
            </div>
          </div>
        </div>
      )}

      {constituencyModal && (
        <ConstituencyModal
          entry={constituencyModal}
          onClose={() => setConstituencyModal(null)}
          onSaved={() => { setConstituencyModal(null); fetchEntries(); }}
        />
      )}

      {loading ? (
        <div className="loading">{t.loadingEntries}</div>
      ) : (
        <EntryTable
          entries={entries.filter(e => {
            if (statusFilter === 'all') return true;
            if (statusFilter === 'Overdue') {
              return e.status !== 'Closed' && (Date.now() - new Date(e.createdAt).getTime()) >= 24 * 60 * 60 * 1000;
            }
            return e.status === statusFilter;
          })}
          user={user}
          onDelete={handleDelete}
          onEdit={entry => setEditEntry(entry)}
          onReply={entry => setReplyModal(entry)}
          onFillConstituency={entry => setConstituencyModal(entry)}
          onAddEvidence={entry => setEvidenceModal(entry)}
          onRefresh={fetchEntries}
          mediaType={mediaType}
        />
      )}
    </div>
  );
}
