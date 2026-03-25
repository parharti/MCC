const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const Entry = require('../models/Entry');
const { requireAdmin } = require('../middleware/auth');

// GET /api/reports - get all closed entries for report (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    let entries = await Entry.find({ status: 'Closed' }).lean();

    // Map _id to id for frontend compatibility
    entries = entries.map(e => ({ id: e._id.toString(), ...e, _id: undefined }));

    // Filter by mediaType if specified
    const mediaTypeFilter = req.query.mediaType;
    const filtered = mediaTypeFilter
      ? entries.filter(e => (e.mediaType || 'social_media') === mediaTypeFilter)
      : entries;

    // Sort by sno
    filtered.sort((a, b) => a.sno - b.sno);

    res.json({ entries: filtered });
  } catch (err) {
    console.error('Reports error:', err);
    res.status(500).json({ error: 'Failed to fetch report data.' });
  }
});

// GET /api/reports/download-excel - download all complaints as Excel
router.get('/download-excel', requireAdmin, async (req, res) => {
  try {
    let entries = await Entry.find().lean();
    entries.sort((a, b) => a.sno - b.sno);

    const rows = entries.map(e => ({
      'S.No': e.sno,
      'Complaint ID': e.complaintId,
      'Date': e.entryDate,
      'Time': e.entryTime || '',
      'Media Type': e.mediaType === 'social_media' ? 'Social Media'
        : e.mediaType === 'print_media' ? 'Print Media'
        : e.mediaType === 'electronic_media' ? 'Electronic Media' : e.mediaType,
      'District': e.districtId,
      'Constituency': e.constituency || '',
      'Gist of Content': e.gist,
      'Source of Complaint': e.sourceOfComplaint || '',
      'News Link': e.newsLink || '',
      'Added By': e.addedBy || 'Admin',
      'Status': e.status,
      'Remark': e.remark || '',
      'Immediate Reply': e.immediateReply || '',
      'Replied Link': e.repliedLink || '',
      'Final Reply': e.finalReply || '',
      'Created At': e.createdAt,
      'Updated At': e.updatedAt,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-width columns
    const colWidths = Object.keys(rows[0] || {}).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String(r[key] || '').length).slice(0, 100), 10)
    }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'All Complaints');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=All_Complaints_Report.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error('Excel download error:', err);
    res.status(500).json({ error: 'Failed to generate Excel report.' });
  }
});

module.exports = router;
