const express = require('express');
const router = express.Router();
const multer = require('multer');
const { db } = require('../config/firebase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { uploadPhoto, deleteEntryPhotos } = require('../services/storageService');
const XLSX = require('xlsx');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// GET /api/entries - get all entries (filtered by district for district users)
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    let query;

    if (user.role === 'district') {
      query = db.collection('entries').where('districtId', '==', user.districtId);
    } else if (req.query.districtId) {
      // Admin filtering by specific district
      query = db.collection('entries').where('districtId', '==', req.query.districtId);
    } else {
      query = db.collection('entries');
    }

    const snapshot = await query.get();
    const entries = [];
    snapshot.forEach(doc => {
      entries.push({ id: doc.id, ...doc.data() });
    });

    // Sort client-side to avoid composite index requirement
    entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ entries });
  } catch (err) {
    console.error('Get entries error:', err);
    res.status(500).json({ error: 'Failed to fetch entries.' });
  }
});

// GET /api/entries/stats - dashboard analytics
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const snapshot = await db.collection('entries').get();
    const allEntries = [];
    snapshot.forEach(doc => allEntries.push(doc.data()));

    const now = new Date();
    const TWENTY_FOUR_HRS = 24 * 60 * 60 * 1000;

    if (user.role === 'admin') {
      // District-wise breakdown for admin
      const districtStats = {};
      allEntries.forEach(entry => {
        const did = entry.districtId;
        if (!districtStats[did]) {
          districtStats[did] = { total: 0, pending: 0, replied: 0, closed: 0, overdue: 0 };
        }
        districtStats[did].total++;
        if (entry.status === 'Pending') districtStats[did].pending++;
        else if (entry.status === 'Replied') districtStats[did].replied++;
        else if (entry.status === 'Closed') districtStats[did].closed++;

        if (entry.status !== 'Closed' && (now - new Date(entry.createdAt)) >= TWENTY_FOUR_HRS) {
          districtStats[did].overdue++;
        }
      });

      const overall = {
        total: allEntries.length,
        pending: allEntries.filter(e => e.status === 'Pending').length,
        replied: allEntries.filter(e => e.status === 'Replied').length,
        closed: allEntries.filter(e => e.status === 'Closed').length,
        overdue: allEntries.filter(e => e.status !== 'Closed' && (now - new Date(e.createdAt)) >= TWENTY_FOUR_HRS).length
      };

      res.json({ overall, districtStats });
    } else {
      // Single district stats
      const myEntries = allEntries.filter(e => e.districtId === user.districtId);
      const stats = {
        total: myEntries.length,
        pending: myEntries.filter(e => e.status === 'Pending').length,
        replied: myEntries.filter(e => e.status === 'Replied').length,
        closed: myEntries.filter(e => e.status === 'Closed').length,
        overdue: myEntries.filter(e => e.status !== 'Closed' && (now - new Date(e.createdAt)) >= TWENTY_FOUR_HRS).length
      };
      res.json({ overall: stats, districtStats: {} });
    }
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

// POST /api/entries - create new entry (admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { newsLink, entryDate, entryTime, districtId, constituency, gist, sourceOfComplaint } = req.body;

    if (!entryDate || !entryTime || !districtId || !gist || !sourceOfComplaint) {
      return res.status(400).json({ error: 'All fields except News Link and Constituency are required.' });
    }

    // Auto-generate complaint ID like SM-001
    // If DB is empty, start from 1. Otherwise use the highest existing sno + 1
    const allSnap = await db.collection('entries').get();
    let maxSno = 0;
    if (allSnap.size > 0) {
      allSnap.forEach(doc => {
        const s = doc.data().sno || 0;
        if (s > maxSno) maxSno = s;
      });
    }
    const countSnap = await db.collection('counters').doc('entries').get();
    let counterVal = countSnap.exists ? countSnap.data().count : 0;
    // Use whichever is higher to avoid ID conflicts
    let sno = Math.max(maxSno, counterVal) + 1;
    // If DB is empty, start from 1
    if (allSnap.size === 0) sno = 1;
    await db.collection('counters').doc('entries').set({ count: sno });

    const complaintId = 'SM-' + String(sno).padStart(3, '0');

    const entryData = {
      sno,
      complaintId,
      newsLink: newsLink || '',
      entryDate,
      entryTime,
      districtId,
      constituency: constituency || '',
      gist,
      sourceOfComplaint,
      status: 'Pending',
      remark: '',
      immediateReply: '',
      finalReply: '',
      evidencePhotos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const docRef = await db.collection('entries').add(entryData);
    res.status(201).json({ id: docRef.id, ...entryData });
  } catch (err) {
    console.error('Create entry error:', err);
    res.status(500).json({ error: 'Failed to create entry.' });
  }
});

// POST /api/entries/upload-excel - bulk create from Excel (admin only)
router.post('/upload-excel', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Handle merged cells - fill merged ranges with the top-left value
    if (sheet['!merges']) {
      for (const merge of sheet['!merges']) {
        const startCell = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
        const val = sheet[startCell] ? sheet[startCell].v : '';
        for (let r = merge.s.r; r <= merge.e.r; r++) {
          for (let c = merge.s.c; c <= merge.e.c; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            if (!sheet[addr]) {
              sheet[addr] = { t: 's', v: val };
            }
          }
        }
      }
    }

    // Helper: format any date value to YYYY-MM-DD
    function formatDate(val) {
      if (!val) return '';
      // Try parsing as Date object first
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
      const str = String(val).trim();
      // DD-MM-YYYY or DD/MM/YYYY
      const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (match) return `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
      return str;
    }

    // Find the header row (look for a row containing "District" or "Gist")
    const range = XLSX.utils.decode_range(sheet['!ref']);
    let headerRow = 0;
    for (let r = 0; r <= Math.min(5, range.e.r); r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const val = sheet[addr] ? String(sheet[addr].v).toLowerCase().trim() : '';
        if (val === 'district' || val === 'gist' || val === 'gist of the content' || val === 's.no') {
          headerRow = r;
          break;
        }
      }
      if (headerRow > 0) break;
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', range: headerRow });

    // Filter out sub-header rows and empty rows
    const dataRows = rows.filter(row => {
      const vals = Object.values(row).map(v => String(v).trim().toLowerCase());
      if (vals.includes('immediate reply') || vals.includes('final reply')) return false;
      return true;
    });

    console.log('Header row detected at:', headerRow);
    console.log('Data rows found:', dataRows.length);
    if (dataRows.length > 0) console.log('First row keys:', Object.keys(dataRows[0]));

    if (dataRows.length === 0) return res.status(400).json({ error: 'Excel file is empty or headers not found.' });

    // Use dataRows instead of rows
    const rows2 = dataRows;

    // Known column mappings (case-insensitive, handles typos)
    const knownMap = {
      'news link': 'newsLink',
      'news links': 'newsLink',
      'newslink': 'newsLink',
      'newslinks': 'newsLink',
      'link': 'newsLink',
      'date': 'entryDate',
      'posted date': 'entryDate',
      'time': 'entryTime',
      'district': 'districtId',
      'gist': 'gist',
      'gist of content': 'gist',
      'gist of the content': 'gist',
      'content': 'gist',
      'source': 'sourceOfComplaint',
      'source of complaint': 'sourceOfComplaint',
      'source of compaint': 'sourceOfComplaint',
      'assembly constituency': 'constituency',
      'assembly consitiuency': 'constituency',
      'constituency': 'constituency',
      's.no': '_sno',
      'sno': '_sno',
      'sl.no': '_sno',
    };

    // Get current counter - sync with actual max sno in DB
    const existingAll = await db.collection('entries').get();
    let maxSno = 0;
    existingAll.forEach(doc => {
      const s = doc.data().sno || 0;
      if (s > maxSno) maxSno = s;
    });
    const countSnap = await db.collection('counters').doc('entries').get();
    let counterVal = countSnap.exists ? countSnap.data().count : 0;
    let sno = Math.max(maxSno, counterVal);
    // If DB is empty, start from 0 (first entry becomes 1)
    if (existingAll.size === 0) sno = 0;

    const { districts } = require('../data/districts');
    const districtLookup = {};
    districts.forEach(d => {
      districtLookup[d.name.toLowerCase()] = d.id;
      districtLookup[d.id] = d.id;
      // Also match partial names like "kanchipuram" from "Kanchipuram"
      districtLookup[d.name.toLowerCase().replace(/\s+/g, '')] = d.id;
    });

    // Helper: parse "Chennai (Aminjikarai)" → { district: "chennai", constituency: "Aminjikarai" }
    function parseDistrictField(val) {
      if (!val) return { district: '', constituency: '' };
      const match = val.match(/^([^(]+?)(?:\s*\(([^)]+)\))?\s*$/);
      if (match) {
        return { district: match[1].trim(), constituency: match[2] ? match[2].trim() : '' };
      }
      return { district: val.trim(), constituency: '' };
    }

    const created = [];
    const errors = [];
    const skipped = [];
    let lastDistrict = '';
    let lastDate = '';
    let lastTime = '';
    let lastSource = '';

    // Load existing entries for duplicate check
    const existingSnap = await db.collection('entries').get();
    const existingSet = new Set();
    existingSnap.forEach(doc => {
      const e = doc.data();
      // Key by gist + district + date + newsLink
      existingSet.add(`${e.districtId}||${e.entryDate}||${e.gist}||${e.newsLink}`);
    });

    for (let i = 0; i < rows2.length; i++) {
      const row = rows2[i];
      const mapped = {};

      // Map columns
      for (const [col, val] of Object.entries(row)) {
        const key = knownMap[col.toLowerCase().trim()];
        if (key) {
          mapped[key] = String(val).trim();
        }
      }

      // Carry forward merged cell values
      if (mapped.districtId) lastDistrict = mapped.districtId;
      else mapped.districtId = lastDistrict;

      if (mapped.entryDate) lastDate = mapped.entryDate;
      else mapped.entryDate = lastDate;

      if (mapped.entryTime) lastTime = mapped.entryTime;
      else mapped.entryTime = lastTime;

      if (mapped.sourceOfComplaint) lastSource = mapped.sourceOfComplaint;
      else mapped.sourceOfComplaint = lastSource;

      // Skip empty rows
      if (!mapped.gist && !mapped.newsLink && !mapped.districtId) continue;

      // Parse district field - may contain constituency like "Chennai (Aminjikarai)"
      let parsedConstituency = mapped.constituency || '';
      if (mapped.districtId) {
        const parsed = parseDistrictField(mapped.districtId);
        mapped.districtId = parsed.district;
        if (parsed.constituency && !parsedConstituency) {
          parsedConstituency = parsed.constituency;
        }
      }

      // Resolve district name to ID
      if (mapped.districtId) {
        const resolved = districtLookup[mapped.districtId.toLowerCase()]
          || districtLookup[mapped.districtId.toLowerCase().replace(/\s+/g, '')];
        if (resolved) {
          mapped.districtId = resolved;
        } else {
          errors.push(`Row ${i + 1}: Unknown district "${mapped.districtId}"`);
          continue;
        }
      } else {
        errors.push(`Row ${i + 1}: District is missing`);
        continue;
      }

      // If no gist but has a link, use link as gist
      if (!mapped.gist && mapped.newsLink) {
        mapped.gist = mapped.newsLink;
      }

      if (!mapped.gist) {
        errors.push(`Row ${i + 1}: Gist/Content is missing`);
        continue;
      }

      // Check duplicate by gist + district + date + link
      const dupeKey = `${mapped.districtId}||${mapped.entryDate || ''}||${mapped.gist}||${mapped.newsLink || ''}`;
      if (existingSet.has(dupeKey)) {
        skipped.push(`Row ${i + 1}: Duplicate, skipped`);
        continue;
      }
      existingSet.add(dupeKey);

      // Store parsed constituency
      mapped.constituency = parsedConstituency;

      sno++;
      const complaintId = 'SM-' + String(sno).padStart(3, '0');

      const entryData = {
        sno,
        complaintId,
        newsLink: mapped.newsLink || '',
        entryDate: formatDate(mapped.entryDate) || new Date().toISOString().split('T')[0],
        entryTime: mapped.entryTime || new Date().toTimeString().slice(0, 5),
        districtId: mapped.districtId,
        constituency: mapped.constituency || '',
        gist: mapped.gist,
        sourceOfComplaint: mapped.sourceOfComplaint || '',
        status: 'Pending',
        immediateReply: '',
        finalReply: '',
        evidencePhotos: [],
        extraData: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.collection('entries').add(entryData);
      created.push(complaintId);
    }

    // Update counter
    await db.collection('counters').doc('entries').set({ count: sno });

    res.json({
      message: `${created.length} complaints created. ${skipped.length} duplicates skipped.`,
      created: created.length,
      skippedCount: skipped.length,
      errors: errors.length > 0 ? errors : undefined,
      skipped: skipped.length > 0 ? skipped : undefined
    });
  } catch (err) {
    console.error('Excel upload error:', err);
    res.status(500).json({ error: 'Failed to process Excel file.' });
  }
});

// DELETE /api/entries/:id - delete entry (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection('entries').doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    // Delete associated photos from storage
    await deleteEntryPhotos(id);
    await db.collection('entries').doc(id).delete();

    res.json({ message: 'Entry deleted successfully.' });
  } catch (err) {
    console.error('Delete entry error:', err);
    res.status(500).json({ error: 'Failed to delete entry.' });
  }
});

// PUT /api/entries/:id/time - admin edits time
router.put('/:id/time', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { entryTime } = req.body;
    if (!entryTime) return res.status(400).json({ error: 'Time is required.' });

    const doc = await db.collection('entries').doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Entry not found.' });

    await db.collection('entries').doc(id).update({ entryTime, updatedAt: new Date().toISOString() });
    res.json({ message: 'Time updated.' });
  } catch (err) {
    console.error('Update time error:', err);
    res.status(500).json({ error: 'Failed to update time.' });
  }
});

// PUT /api/entries/:id/constituency - district officer fills constituency
router.put('/:id/constituency', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { constituency } = req.body;
    const user = req.user;

    if (user.role !== 'district') {
      return res.status(403).json({ error: 'Only district officers can update constituency.' });
    }

    const doc = await db.collection('entries').doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Entry not found.' });

    const entry = doc.data();
    if (entry.districtId !== user.districtId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (!constituency || !constituency.trim()) {
      return res.status(400).json({ error: 'Constituency is required.' });
    }

    await db.collection('entries').doc(id).update({
      constituency,
      updatedAt: new Date().toISOString()
    });

    res.json({ message: 'Constituency updated.' });
  } catch (err) {
    console.error('Update constituency error:', err);
    res.status(500).json({ error: 'Failed to update constituency.' });
  }
});

// PUT /api/entries/:id/remark - update remark (both roles, non-closed entries)
router.put('/:id/remark', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { remark } = req.body;
    const user = req.user;

    const doc = await db.collection('entries').doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    const entry = doc.data();

    if (entry.status === 'Closed') {
      return res.status(400).json({ error: 'Cannot edit remarks on closed entries.' });
    }

    // District officers can only edit their own district
    if (user.role === 'district' && entry.districtId !== user.districtId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    await db.collection('entries').doc(id).update({
      remark,
      updatedAt: new Date().toISOString()
    });

    res.json({ message: 'Remark updated.' });
  } catch (err) {
    console.error('Update remark error:', err);
    res.status(500).json({ error: 'Failed to update remark.' });
  }
});

// PUT /api/entries/:id/immediate-reply - submit immediate reply (district only)
router.put('/:id/immediate-reply', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { immediateReply } = req.body;
    const user = req.user;

    if (user.role !== 'district') {
      return res.status(403).json({ error: 'Only district officers can submit replies.' });
    }

    const doc = await db.collection('entries').doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    const entry = doc.data();

    if (entry.districtId !== user.districtId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (entry.status !== 'Pending') {
      return res.status(400).json({ error: 'Immediate reply can only be submitted for pending entries.' });
    }

    if (!immediateReply || !immediateReply.trim()) {
      return res.status(400).json({ error: 'Immediate reply cannot be empty.' });
    }

    await db.collection('entries').doc(id).update({
      immediateReply,
      status: 'Replied',
      updatedAt: new Date().toISOString()
    });

    res.json({ message: 'Immediate reply submitted. Status changed to Replied.' });
  } catch (err) {
    console.error('Immediate reply error:', err);
    res.status(500).json({ error: 'Failed to submit immediate reply.' });
  }
});

// PUT /api/entries/:id/final-reply - submit final reply with evidence (district only)
router.put('/:id/final-reply', requireAuth, upload.array('photos', 50), async (req, res) => {
  try {
    const { id } = req.params;
    const { finalReply } = req.body;
    const user = req.user;

    if (user.role !== 'district') {
      return res.status(403).json({ error: 'Only district officers can submit replies.' });
    }

    const doc = await db.collection('entries').doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    const entry = doc.data();

    if (entry.districtId !== user.districtId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (entry.status !== 'Replied') {
      return res.status(400).json({ error: 'Final reply can only be submitted for replied entries.' });
    }

    if (!finalReply || !finalReply.trim()) {
      return res.status(400).json({ error: 'Final reply cannot be empty.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one evidence photo is required.' });
    }

    // Save photos
    const photoUrls = [];
    for (const file of req.files) {
      const result = await uploadPhoto(file.buffer, file.originalname, id);
      photoUrls.push(result);
    }

    await db.collection('entries').doc(id).update({
      finalReply,
      evidencePhotos: photoUrls,
      status: 'Closed',
      updatedAt: new Date().toISOString()
    });

    res.json({ message: 'Final reply submitted with evidence. Entry closed.' });
  } catch (err) {
    console.error('Final reply error:', err);
    res.status(500).json({ error: 'Failed to submit final reply.' });
  }
});

module.exports = router;
