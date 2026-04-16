const express = require('express');
const router = express.Router();
const Entry = require('../models/Entry');
const { requireAdmin } = require('../middleware/auth');

// GET /api/reports - get closed entries for report (admin only) with server-side filtering
router.get('/', requireAdmin, async (req, res) => {
  try {
    const filter = { status: 'Closed' };
    if (req.query.mediaType) {
      filter.mediaType = req.query.mediaType;
    }

    let entries = await Entry.find(filter).sort({ sno: 1 }).lean();

    // Map _id to id for frontend compatibility
    entries = entries.map(e => ({ id: e._id.toString(), ...e, _id: undefined }));

    res.json({ entries });
  } catch (err) {
    console.error('Reports error:', err);
    res.status(500).json({ error: 'Failed to fetch report data.' });
  }
});

// Excel download is now handled client-side to save server CPU

module.exports = router;
