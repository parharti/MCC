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
  const [replyModal, setReplyModal] = useState(null);
  const [constituencyModal, setConstituencyModal] = useState(null);
  const [showExcelUpload, setShowExcelUpload] = useState(false);
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
    fetchEntries();
  }

  function handleReplySubmitted() {
    setReplyModal(null);
    fetchEntries();
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

      {showEntryForm && (
        <EntryForm
          onClose={() => setShowEntryForm(false)}
          onCreated={handleEntryCreated}
          defaultMediaType={mediaType || 'social_media'}
        />
      )}

      {replyModal && (
        <ReplyModal
          entry={replyModal}
          onClose={() => setReplyModal(null)}
          onSubmitted={handleReplySubmitted}
        />
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
          onReply={entry => setReplyModal(entry)}
          onFillConstituency={entry => setConstituencyModal(entry)}
          onRefresh={fetchEntries}
          mediaType={mediaType}
        />
      )}
    </div>
  );
}
