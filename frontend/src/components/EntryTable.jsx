import { useState, useRef, useEffect } from 'react';
import { useLang } from '../context/LangContext';
import ReportView from './ReportView';

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

function getHoursSince(dateStr) {
  const created = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - created) / (1000 * 60 * 60));
}

function StatusBadge({ status, createdAt, t, showOverdue }) {
  const hours = getHoursSince(createdAt);
  const isOverdue = showOverdue && status !== 'Closed' && status !== 'Dropped' && hours >= 24;

  let className = 'badge ';
  if (status === 'Pending') className += 'badge-pending';
  else if (status === 'Replied') className += 'badge-replied';
  else if (status === 'Dropped') className += 'badge-dropped';
  else className += 'badge-closed';

  const statusLabel = status === 'Pending' ? t.pending : status === 'Replied' ? t.replied : status === 'Dropped' ? t.dropped : t.closed;

  return (
    <div className="status-cell">
      <span className={className}>{statusLabel}</span>
      {isOverdue && <span className="badge badge-overdue">{t.overdueLabel} ({hours}h)</span>}
    </div>
  );
}

function AdminActionsMenu({ entry, onEdit, onDelete, onDrop, onReport, t }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="admin-actions-menu" ref={menuRef}>
      <button className="btn btn-sm btn-secondary admin-actions-toggle" onClick={() => setOpen(o => !o)}>
        ⋮
      </button>
      {open && (
        <div className="admin-actions-dropdown">
          <button onClick={() => { onEdit(entry); setOpen(false); }}>{t.edit}</button>
          {(entry.status === 'Pending' || entry.status === 'Replied') && (
            <button className="action-drop" onClick={() => { onDrop(entry); setOpen(false); }}>{t.drop}</button>
          )}
          {entry.status === 'Closed' && (
            <button onClick={() => { onReport(entry); setOpen(false); }}>{t.report}</button>
          )}
          <button className="action-delete" onClick={() => { onDelete(entry.id); setOpen(false); }}>{t.delete}</button>
        </div>
      )}
    </div>
  );
}

export default function EntryTable({ entries, user, onDelete, onEdit, onReply, onDrop, onFillConstituency, onRefresh, mediaType }) {
  const [reportEntry, setReportEntry] = useState(null);
  const [editingTime, setEditingTime] = useState(null);
  const [newTime, setNewTime] = useState('');
  const [sortField, setSortField] = useState('sno');
  const [sortOrder, setSortOrder] = useState('desc');
  const { t } = useLang();

  // Determine if we should show interim reply / overdue for this view
  const isSocialMedia = !mediaType || mediaType === 'social_media';

  // For "all complaints" view (no mediaType filter), check per-entry
  const showInterimReply = !mediaType || mediaType === 'social_media';
  const showTime = !mediaType || mediaType === 'social_media';

  async function saveTime(entryId) {
    try {
      const api = (await import('../services/api')).default;
      await api.put(`/entries/${entryId}/time`, { entryTime: newTime });
      setEditingTime(null);
      if (onRefresh) onRefresh();
    } catch { }
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  }

  const sortArrow = (field) => sortField === field ? (sortOrder === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  const sortedEntries = [...entries].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'sno') {
      cmp = a.sno - b.sno;
    } else if (sortField === 'date') {
      cmp = new Date(a.entryDate + ' ' + (a.entryTime || '00:00')) - new Date(b.entryDate + ' ' + (b.entryTime || '00:00'));
    } else if (sortField === 'time') {
      cmp = (a.entryTime || '').localeCompare(b.entryTime || '');
    }
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  function isEntrySocialMedia(entry) {
    return !entry.mediaType || entry.mediaType === 'social_media';
  }

  return (
    <>
      {reportEntry && (
        <ReportView entry={reportEntry} onClose={() => setReportEntry(null)} />
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th className="th-sortable" onClick={() => handleSort('sno')}>
                {t.complaintId}{sortArrow('sno')}
              </th>
              <th className="th-sortable" onClick={() => handleSort('date')}>
                {t.date}{sortArrow('date')}
              </th>
              {showTime && (
                <th className="th-sortable" onClick={() => handleSort('time')}>
                  {t.time}{sortArrow('time')}
                </th>
              )}
              {user.role === 'admin' && <th>{t.district}</th>}
              {user.role === 'district' && <th>{t.constituency}</th>}
              <th>{t.gistOfContent}</th>
              <th>{t.source}</th>
              <th>{t.addedBy}</th>
              <th>{t.newsLink}</th>
              <th>{t.status}</th>
              {showInterimReply && <th>{t.immediateReply}</th>}
              <th>{t.finalReply}</th>
              <th>{t.repliedLink}</th>
              <th>{t.evidence}</th>
              <th>{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map(entry => {
              const entrySocial = isEntrySocialMedia(entry);
              const showOverdue = mediaType ? isSocialMedia : entrySocial;

              return (
                <tr key={entry.id} className={
                  showOverdue && entry.status !== 'Closed' && entry.status !== 'Dropped' && getHoursSince(entry.createdAt) >= 24
                    ? 'row-overdue' : ''
                }>
                  <td><strong>{entry.complaintId || `SM-${String(entry.sno).padStart(3, '0')}`}</strong></td>
                  <td>{entry.entryDate}</td>
                  {showTime && (
                    <td>
                      {user.role === 'admin' && editingTime === entry.id ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                            style={{ width: '100px', padding: '2px 4px', fontSize: '13px' }} />
                          <button className="btn btn-sm btn-primary" onClick={() => saveTime(entry.id)}
                            style={{ padding: '2px 6px', fontSize: '11px' }}>OK</button>
                        </div>
                      ) : (
                        <span
                          onClick={() => { if (user.role === 'admin') { setEditingTime(entry.id); setNewTime(entry.entryTime); }}}
                          style={user.role === 'admin' ? { cursor: 'pointer', borderBottom: '1px dashed var(--gray-300)' } : {}}
                        >
                          {entry.entryTime}
                        </span>
                      )}
                    </td>
                  )}
                  {user.role === 'admin' && <td>{DISTRICT_NAMES[entry.districtId] || entry.districtId}</td>}
                  {user.role === 'district' && (
                    <td>
                      {entry.constituency || (
                        onFillConstituency ? (
                          <button className="btn btn-sm btn-secondary"
                            onClick={() => onFillConstituency(entry)}>{t.fillConstituency}</button>
                        ) : <span className="text-muted">--</span>
                      )}
                    </td>
                  )}
                  <td className="cell-gist">{entry.gist}</td>
                  <td>{entry.sourceOfComplaint}</td>
                  <td>{entry.addedBy || 'Admin'}</td>
                  <td>
                    {entry.newsLink ? (
                      <a href={entry.newsLink} target="_blank" rel="noopener noreferrer"
                        className="link">{t.view}</a>
                    ) : '-'}
                  </td>
                  <td><StatusBadge status={entry.status} createdAt={entry.createdAt} t={t} showOverdue={showOverdue} /></td>
                  {showInterimReply && <td className="cell-reply">{entry.immediateReply || '-'}</td>}
                  <td className="cell-reply">{entry.finalReply || '-'}</td>
                  <td>
                    {entry.repliedLink ? (
                      <a href={entry.repliedLink} target="_blank" rel="noopener noreferrer"
                        className="link">{t.view}</a>
                    ) : '-'}
                  </td>
                  <td>
                    {entry.evidencePhotos && entry.evidencePhotos.length > 0 ? (
                      <div className="evidence-links">
                        {entry.evidencePhotos.map((p, i) => {
                          const name = p.filename || `File ${i + 1}`;
                          const ext = name.split('.').pop().toLowerCase();
                          const isImg = ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext);
                          return (
                            <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                              className="link">{isImg ? `Photo ${i + 1}` : name}</a>
                          );
                        })}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="cell-actions">
                    {/* Social media: Pending → Immediate Reply, then Replied → Final Reply */}
                    {/* Print/Electronic: Pending → Final Reply directly */}
                    {user.role === 'district' && entry.status === 'Pending' && entrySocial && (
                      <button className="btn btn-sm btn-action-red"
                        onClick={() => onReply(entry)}>{t.immediateReply}</button>
                    )}

                    {user.role === 'district' && entry.status === 'Pending' && !entrySocial && (
                      <button className="btn btn-sm btn-action-yellow"
                        onClick={() => onReply(entry)}>{t.finalReply}</button>
                    )}

                    {user.role === 'district' && entry.status === 'Replied' && (
                      <button className="btn btn-sm btn-action-yellow"
                        onClick={() => onReply(entry)}>{t.finalReply}</button>
                    )}

                    {user.role === 'district' && entry.status === 'Closed' && (
                      <span className="btn btn-sm btn-action-green">{t.closed}</span>
                    )}

                    {user.role === 'district' && entry.status === 'Dropped' && (
                      <span className="btn btn-sm btn-action-dropped">{t.dropped}</span>
                    )}

                    {/* Admin: Dropped badge */}
                    {user.role === 'admin' && entry.status === 'Dropped' && (
                      <span className="btn btn-sm btn-action-dropped">{t.dropped}</span>
                    )}

                    {/* Admin: Actions dropdown */}
                    {user.role === 'admin' && (
                      <AdminActionsMenu
                        entry={entry}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onDrop={onDrop}
                        onReport={setReportEntry}
                        t={t}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
            {sortedEntries.length === 0 && (
              <tr>
                <td colSpan={99} className="empty-state">
                  {t.noEntries}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
