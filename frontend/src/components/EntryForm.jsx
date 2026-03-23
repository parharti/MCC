import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import api from '../services/api';

export default function EntryForm({ onClose, onCreated, defaultMediaType }) {
  const { user } = useAuth();
  const { t } = useLang();
  const [districts, setDistricts] = useState([]);
  const [form, setForm] = useState({
    newsLink: '',
    entryDate: new Date().toISOString().split('T')[0],
    entryTime: new Date().toTimeString().slice(0, 5),
    districtId: user.role === 'district' ? user.districtId : '',
    gist: '',
    sourceOfComplaint: '',
    mediaType: defaultMediaType || 'social_media'
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

    if (!form.entryDate || !form.entryTime || !form.districtId ||
        !form.gist || !form.sourceOfComplaint) {
      setError(t.allFieldsRequired);
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/entries', form);
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create entry.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>{t.addNewEntry}</h3>
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
              <label>{t.newsLinkLabel}</label>
              <input type="url" name="newsLink" value={form.newsLink}
                onChange={handleChange} placeholder="https://..." />
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

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t.cancel}</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t.saving : t.addEntry}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
