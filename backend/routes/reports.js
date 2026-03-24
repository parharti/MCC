const express = require('express');
const router = express.Router();
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

module.exports = router;
