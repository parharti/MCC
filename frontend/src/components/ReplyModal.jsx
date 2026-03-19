import { useState } from 'react';
import { useLang } from '../context/LangContext';
import api from '../services/api';

export default function ReplyModal({ entry, onClose, onSubmitted }) {
  const { t } = useLang();
  const isImmediate = entry.status === 'Pending';
  const [reply, setReply] = useState('');
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!reply.trim()) {
      setError(t.replyEmpty);
      return;
    }

    if (!isImmediate && photos.length === 0) {
      setError(t.photoRequired);
      return;
    }

    setSubmitting(true);
    try {
      if (isImmediate) {
        await api.put(`/entries/${entry.id}/immediate-reply`, { immediateReply: reply });
      } else {
        const formData = new FormData();
        formData.append('finalReply', reply);
        for (const photo of photos) {
          formData.append('photos', photo);
        }
        await api.put(`/entries/${entry.id}/final-reply`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      onSubmitted();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit reply.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>{isImmediate ? t.submitImmediateReply : t.submitFinalReply}</h3>
          <button className="btn-close" onClick={onClose}>X</button>
        </div>

        <div className="modal-entry-info">
          <p><strong>{t.sno}:</strong> {entry.sno}</p>
          <p><strong>{t.gistOfContent}:</strong> {entry.gist}</p>
          <p><strong>{t.constituency}:</strong> {entry.constituency}</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-msg">{error}</div>}

          <div className="form-group">
            <label>{isImmediate ? t.immediateReply : t.finalReply} *</label>
            <textarea value={reply} onChange={e => setReply(e.target.value)}
              rows="4" required placeholder={t.replyPlaceholder} />
          </div>

          {!isImmediate && (
            <div className="form-group">
              <label>{t.evidencePhotos} *</label>
              <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.odt"
                onChange={e => setPhotos(Array.from(e.target.files))} />
              {photos.length > 0 && (
                <p className="file-count">{photos.length} {t.filesSelected}</p>
              )}
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t.cancel}</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t.submitting : t.submitReply}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
