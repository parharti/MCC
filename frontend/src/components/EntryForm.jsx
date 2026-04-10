import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import api from '../services/api';

export default function EntryForm({ onClose, onCreated, defaultMediaType, editEntry }) {
  const { user } = useAuth();
  const { t } = useLang();
  const isEdit = !!editEntry;
  const [districts, setDistricts] = useState([]);
  const [form, setForm] = useState({
    newsLink: editEntry?.newsLink || '',
    entryDate: editEntry?.entryDate || new Date().toISOString().split('T')[0],
    entryTime: editEntry?.entryTime || new Date().toTimeString().slice(0, 5),
    districtId: editEntry?.districtId || (user.role === 'district' ? user.districtId : ''),
    gist: editEntry?.gist || '',
    sourceOfComplaint: editEntry?.sourceOfComplaint || '',
    mediaType: editEntry?.mediaType || defaultMediaType || 'social_media',
    category: editEntry?.category || '',
    ...(isEdit && user.role === 'admin' ? {
      immediateReply: editEntry?.immediateReply || '',
      finalReply: editEntry?.finalReply || '',
      repliedLink: editEntry?.repliedLink || '',
      remark: editEntry?.remark || '',
      status: editEntry?.status || 'Pending',
    } : {})
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [newEvidenceFiles, setNewEvidenceFiles] = useState([]);

  useEffect(() => {
    if (user.role === 'admin') {
      api.get('/districts').then(res => setDistricts(res.data.districts)).catch(() => {});
    }
  }, [user.role]);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.entryDate || !form.districtId ||
        !form.gist || !form.sourceOfComplaint) {
      setError(t.allFieldsRequired);
      return;
    }
    if (form.mediaType === 'social_media' && !form.entryTime) {
      setError(t.allFieldsRequired);
      return;
    }
    if (form.mediaType === 'social_media' && user.role === 'district' && !form.newsLink?.trim()) {
      setError(t.newsLinkRequired || 'News Link is required for Social Media entries.');
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await api.put(`/entries/${editEntry.id}`, form);
        if (newEvidenceFiles.length > 0) {
          const formData = new FormData();
          for (const file of newEvidenceFiles) {
            formData.append('photos', file);
          }
          await api.put(`/entries/${editEntry.id}/add-evidence`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120000,
          });
        }
      } else {
        await api.post('/entries', form);
      }
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || (isEdit ? 'Failed to update entry.' : 'Failed to create entry.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>{isEdit ? t.editEntry : t.addNewEntry}</h3>
          <button className="btn-close" onClick={onClose}>X</button>
        </div>

        <form onSubmit={handleSubmit} className="entry-form">
          {error && <div className="error-msg">{error}</div>}

          <div className="form-group">
            <label>{t.mediaTypeLabel} *</label>
            <select name="mediaType" value={form.mediaType} onChange={handleChange} required>
              <option value="social_media">{t.socialMedia}</option>
              <option value="print_media">{t.printMedia}</option>
              <option value="electronic_media">{t.electronicMedia}</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t.newsLinkLabel}{form.mediaType === 'social_media' && user.role === 'district' ? ' *' : ''}</label>
              <input type="url" name="newsLink" value={form.newsLink}
                onChange={handleChange} placeholder="https://..."
                required={form.mediaType === 'social_media' && user.role === 'district'} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t.dateLabel} *</label>
              <input type="date" name="entryDate" value={form.entryDate}
                onChange={handleChange} required />
            </div>
            {form.mediaType === 'social_media' && (
              <div className="form-group">
                <label>{t.timeLabel} *</label>
                <input type="time" name="entryTime" value={form.entryTime}
                  onChange={handleChange} required />
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t.districtLabel} *</label>
              {user.role === 'district' ? (
                <input type="text" value={user.districtName || user.districtId} disabled />
              ) : (
                <select name="districtId" value={form.districtId}
                  onChange={handleChange} required>
                  <option value="">-- {t.selectDistrict} --</option>
                  {districts.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>{t.gistLabel} *</label>
            <textarea name="gist" value={form.gist} onChange={handleChange}
              rows="3" required placeholder={t.gistPlaceholder} />
          </div>

          <div className="form-group">
            <label>{t.sourceLabel} *</label>
            <input type="text" name="sourceOfComplaint" value={form.sourceOfComplaint}
              onChange={handleChange} required placeholder={t.sourcePlaceholder} />
          </div>

          {user.role === 'admin' && (
            <div className="form-group">
              <label>{t.category}</label>
              <select name="category" value={form.category} onChange={handleChange}>
                <option value="">{t.allCategories}</option>
                <option value="MCC Violation">{t.mccViolation}</option>
                <option value="Fake News">{t.fakeNews}</option>
                <option value="Negative News">{t.negativeNews}</option>
                <option value="Paid News">{t.paidNews}</option>
              </select>
            </div>
          )}

          {isEdit && user.role === 'admin' && (
            <>
              <hr style={{ margin: '12px 0', borderColor: '#eee' }} />
              <h4 style={{ margin: '8px 0', color: '#555' }}>District Replies (Admin Edit)</h4>

              <div className="form-group">
                <label>Status</label>
                <select name="status" value={form.status} onChange={handleChange}>
                  <option value="Pending">Pending</option>
                  <option value="Replied">Replied</option>
                  <option value="Closed">Closed</option>
                  <option value="Dropped">Dropped</option>
                </select>
              </div>

              <div className="form-group">
                <label>Immediate Reply</label>
                <textarea name="immediateReply" value={form.immediateReply} onChange={handleChange}
                  rows="2" placeholder="Immediate reply from district" />
              </div>

              <div className="form-group">
                <label>Final Reply</label>
                <textarea name="finalReply" value={form.finalReply} onChange={handleChange}
                  rows="2" placeholder="Final reply from district" />
              </div>

              <div className="form-group">
                <label>Replied Link</label>
                <input type="url" name="repliedLink" value={form.repliedLink} onChange={handleChange}
                  placeholder="https://..." />
              </div>

              <div className="form-group">
                <label>Remark</label>
                <textarea name="remark" value={form.remark} onChange={handleChange}
                  rows="2" placeholder="Admin remark" />
              </div>

              <div className="form-group">
                <label>Evidence Files</label>
                {editEntry?.evidencePhotos?.length > 0 && (
                  <p style={{ fontSize: '13px', color: '#666', margin: '4px 0' }}>
                    Existing: {editEntry.evidencePhotos.length} file(s)
                  </p>
                )}
                <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.odt"
                  onChange={e => setNewEvidenceFiles(Array.from(e.target.files))} />
                {newEvidenceFiles.length > 0 && (
                  <p className="file-count">{newEvidenceFiles.length} new file(s) selected (will be added to existing)</p>
                )}
              </div>
            </>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t.cancel}</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t.saving : (isEdit ? t.saveChanges : t.addEntry)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
