import { useState } from 'react';
import { useLang } from '../context/LangContext';
import api from '../services/api';

export default function ReplyModal({ entry, onClose, onSubmitted }) {
  const { t } = useLang();
  const entrySocial = !entry.mediaType || entry.mediaType === 'social_media';
  // For social media: Pending → immediate reply, Replied → final reply
  // For print/electronic: Pending → final reply directly (skip immediate)
  const isImmediate = entrySocial && entry.status === 'Pending';
  const [reply, setReply] = useState('');
  const [repliedLink, setRepliedLink] = useState('');
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!reply.trim()) {
      setError(t.replyEmpty);
      return;
    }

    if (!isImmediate && entrySocial && !repliedLink.trim()) {
      setError(t.repliedLinkRequired || 'Replied Link is required for Social Media entries.');
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
        formData.append('repliedLink', repliedLink);
        for (const photo of photos) {
          formData.append('photos', photo);
        }
        await api.put(`/entries/${entry.id}/final-reply`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000,
          onUploadProgress: (e) => {
            if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
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
              <label>{t.repliedLink}{entrySocial ? ' *' : ''}</label>
              <input type="url" value={repliedLink} onChange={e => setRepliedLink(e.target.value)}
                placeholder={t.repliedLinkPlaceholder} required={entrySocial} />
            </div>
          )}

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
              {submitting
                ? (!isImmediate && uploadProgress > 0 && uploadProgress < 100
                    ? `${t.uploading} ${uploadProgress}%`
                    : t.submitting)
                : t.submitReply}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
