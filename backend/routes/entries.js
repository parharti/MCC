const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');
const Entry = require('../models/Entry');
const Counter = require('../models/Counter');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { uploadPhoto, deleteEntryPhotos } = require('../services/storageService');
const XLSX = require('xlsx');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// No-op kept for backward compat with calls elsewhere in this file
function invalidateStatsCache() { }

const MEDIA_TYPE_PREFIX = {
  social_media: 'SM',
  print_media: 'PM',
  electronic_media: 'EM',
};
const GLOBAL_COUNTER = 'entries';

// GET /api/entries - get entries with server-side filtering and pagination
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    let filter = {};

    if (user.role === 'district') {
      filter.districtId = user.districtId;
    } else if (req.query.districtId) {
      filter.districtId = req.query.districtId;
    }

    // Server-side mediaType filter
    if (req.query.mediaType) {
      filter.mediaType = req.query.mediaType;
    }

    // Server-side status filter
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Server-side date range filter (for DailyReport)
    if (req.query.dateFrom || req.query.dateTo) {
      filter.entryDate = {};
      if (req.query.dateFrom) filter.entryDate.$gte = req.query.dateFrom;
      if (req.query.dateTo) filter.entryDate.$lte = req.query.dateTo;
    }

    // Server-side addedBy filter
    if (req.query.addedBy === 'admin') {
      filter.addedBy = 'Admin';
    } else if (req.query.addedBy === 'district') {
      filter.addedBy = { $ne: 'Admin' };
    }

    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 0; // 0 = no limit (backward compat)

    let query = Entry.find(filter).sort({ createdAt: -1 });
    if (limit > 0) {
      query = query.skip(page * limit).limit(limit);
    }
    let entries = await query.lean();

    // Map _id to id for frontend compatibility
    entries = entries.map(e => ({ id: e._id.toString(), ...e, _id: undefined }));

    res.json({ entries });
  } catch (err) {
    console.error('Get entries error:', err);
    res.status(500).json({ error: 'Failed to fetch entries.' });
  }
});

// GET /api/entries/stats - dashboard analytics (MongoDB aggregation - no full collection load)
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const overdueThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const matchStage = user.role === 'admin' ? {} : { districtId: user.districtId };

    const pipeline = [
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
      {
        $addFields: {
          effectiveMediaType: { $ifNull: ['$mediaType', 'social_media'] },
          isOverdue: {
            $and: [
              { $not: { $in: ['$status', ['Closed', 'Dropped']] } },
              { $lte: [{ $toDate: '$createdAt' }, overdueThreshold] }
            ]
          },
          isAdmin: { $eq: ['$addedBy', 'Admin'] }
        }
      },
      {
        $group: {
          _id: { districtId: '$districtId', mediaType: '$effectiveMediaType' },
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
          replied: { $sum: { $cond: [{ $eq: ['$status', 'Replied'] }, 1, 0] } },
          closed: { $sum: { $cond: [{ $eq: ['$status', 'Closed'] }, 1, 0] } },
          dropped: { $sum: { $cond: [{ $eq: ['$status', 'Dropped'] }, 1, 0] } },
          overdue: { $sum: { $cond: ['$isOverdue', 1, 0] } },
          addedByAdmin: { $sum: { $cond: ['$isAdmin', 1, 0] } },
          addedByDistrict: { $sum: { $cond: ['$isAdmin', 0, 1] } },
          mccViolation: { $sum: { $cond: [{ $eq: ['$category', 'MCC Violation'] }, 1, 0] } },
          fakeNews: { $sum: { $cond: [{ $eq: ['$category', 'Fake News'] }, 1, 0] } },
          negativeNews: { $sum: { $cond: [{ $eq: ['$category', 'Negative News'] }, 1, 0] } },
          paidNews: { $sum: { $cond: [{ $eq: ['$category', 'Paid News'] }, 1, 0] } },
          voterAssistance: { $sum: { $cond: [{ $eq: ['$category', 'Voter Assistance'] }, 1, 0] } },
          misinformation: { $sum: { $cond: [{ $eq: ['$category', 'Misinformation'] }, 1, 0] } }
        }
      }
    ];

    const results = await Entry.aggregate(pipeline);

    const emptyStats = () => ({ total: 0, pending: 0, replied: 0, closed: 0, dropped: 0, overdue: 0 });
    const overall = emptyStats();
    const districtStats = {};
    const mediaTypeStats = {
      social_media: emptyStats(),
      print_media: emptyStats(),
      electronic_media: emptyStats()
    };

    for (const row of results) {
      const did = row._id.districtId;
      const mt = row._id.mediaType;

      // Overall totals
      overall.total += row.total;
      overall.pending += row.pending;
      overall.replied += row.replied;
      overall.closed += row.closed;
      overall.dropped += row.dropped;
      overall.overdue += row.overdue;

      // Media type totals
      if (mediaTypeStats[mt]) {
        mediaTypeStats[mt].total += row.total;
        mediaTypeStats[mt].pending += row.pending;
        mediaTypeStats[mt].replied += row.replied;
        mediaTypeStats[mt].closed += row.closed;
        mediaTypeStats[mt].dropped += row.dropped;
      }

      // District stats (admin only)
      if (user.role === 'admin') {
        if (!districtStats[did]) {
          districtStats[did] = {
            ...emptyStats(),
            addedByAdmin: 0,
            addedByDistrict: 0,
            mccViolation: 0,
            fakeNews: 0,
            negativeNews: 0,
            paidNews: 0,
            voterAssistance: 0,
            misinformation: 0,
            social_media: emptyStats(),
            print_media: emptyStats(),
            electronic_media: emptyStats()
          };
        }
        const ds = districtStats[did];
        ds.total += row.total;
        ds.pending += row.pending;
        ds.replied += row.replied;
        ds.closed += row.closed;
        ds.dropped += row.dropped;
        ds.overdue += row.overdue;
        ds.addedByAdmin += row.addedByAdmin;
        ds.addedByDistrict += row.addedByDistrict;
        ds.mccViolation += row.mccViolation || 0;
        ds.fakeNews += row.fakeNews || 0;
        ds.negativeNews += row.negativeNews || 0;
        ds.paidNews += row.paidNews || 0;
        ds.voterAssistance += row.voterAssistance || 0;
        ds.misinformation += row.misinformation || 0;

        if (ds[mt]) {
          ds[mt].total += row.total;
          ds[mt].pending += row.pending;
          ds[mt].replied += row.replied;
          ds[mt].closed += row.closed;
          ds[mt].dropped += row.dropped;
          ds[mt].overdue += row.overdue;
        }
      }
    }

    res.json({ overall, districtStats, mediaTypeStats });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

// POST /api/entries - create new entry (admin and district users)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { newsLink, entryDate, entryTime, districtId: bodyDistrictId, constituency, gist, sourceOfComplaint, mediaType: reqMediaType, category: reqCategory } = req.body;

    const mediaType = reqMediaType || 'social_media';

    const districtId = req.user.role === 'district' ? req.user.districtId : bodyDistrictId;

    if (!entryDate || !districtId || !gist || !sourceOfComplaint) {
      return res.status(400).json({ error: 'All fields except News Link and Constituency are required.' });
    }
    if (mediaType === 'social_media' && !entryTime) {
      return res.status(400).json({ error: 'Time is required for Social Media entries.' });
    }
    if (mediaType === 'social_media' && req.user.role === 'district' && (!newsLink || !newsLink.trim())) {
      return res.status(400).json({ error: 'News Link is required for Social Media entries.' });
    }
    const prefix = MEDIA_TYPE_PREFIX[mediaType];
    if (!prefix) {
      return res.status(400).json({ error: 'Invalid media type.' });
    }

    // Atomically increment counter using findOneAndUpdate
    const counter = await Counter.findOneAndUpdate(
      { _id: GLOBAL_COUNTER },
      { $inc: { count: 1 } },
      { new: true, upsert: true }
    );

    const sno = counter.count;
    const complaintId = prefix + '-' + String(sno).padStart(3, '0');

    const entryData = {
      sno,
      complaintId,
      mediaType,
      newsLink: newsLink || '',
      entryDate,
      entryTime,
      districtId,
      constituency: constituency || '',
      gist,
      sourceOfComplaint,
      addedBy: req.user.role === 'admin' ? 'Admin' : (req.user.districtName || req.user.districtId),
      category: reqCategory || '',
      status: 'Pending',
      remark: '',
      immediateReply: '',
      repliedLink: '',
      finalReply: '',
      evidencePhotos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const entry = await Entry.create(entryData);

    invalidateStatsCache();
    res.status(201).json({ id: entry._id.toString(), ...entryData });
  } catch (err) {
    console.error('Create entry error:', err);
    res.status(500).json({ error: 'Failed to create entry.' });
  }
});

// POST /api/entries/upload-excel - bulk create from Excel (admin only)
router.post('/upload-excel', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const mediaType = req.body.mediaType || 'social_media';
    const prefix = MEDIA_TYPE_PREFIX[mediaType];
    if (!prefix) {
      return res.status(400).json({ error: 'Invalid media type.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Handle merged cells
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

    function formatDate(val) {
      if (!val) return '';
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
      const str = String(val).trim();
      const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (match) return `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
      return str;
    }

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

    const dataRows = rows.filter(row => {
      const vals = Object.values(row).map(v => String(v).trim().toLowerCase());
      if (vals.includes('immediate reply') || vals.includes('final reply')) return false;
      return true;
    });

    console.log('Header row detected at:', headerRow);
    console.log('Data rows found:', dataRows.length);
    if (dataRows.length > 0) console.log('First row keys:', Object.keys(dataRows[0]));

    if (dataRows.length === 0) return res.status(400).json({ error: 'Excel file is empty or headers not found.' });

    const rows2 = dataRows;

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

    const { districts } = require('../data/districts');
    const districtLookup = {};
    districts.forEach(d => {
      districtLookup[d.name.toLowerCase()] = d.id;
      districtLookup[d.id] = d.id;
      districtLookup[d.code] = d.id;
      districtLookup[d.name.toLowerCase().replace(/\s+/g, '')] = d.id;
    });

    const districtAliases = {
      'kovai': 'coimbatore', 'cbe': 'coimbatore', 'coimbathore': 'coimbatore', 'kovaai': 'coimbatore',
      'thiruvallur': 'tiruvallur', 'thirullavi': 'tiruvallur', 'thirullavar': 'tiruvallur', 'tiruvallore': 'tiruvallur',
      'madras': 'chennai', 'chennnai': 'chennai', 'cennai': 'chennai',
      'trichy': 'tiruchirappalli', 'tiruchi': 'tiruchirappalli', 'trichirappalli': 'tiruchirappalli', 'tiruchy': 'tiruchirappalli', 'tiruchchirapalli': 'tiruchirappalli',
      'tuticorin': 'thoothukudi', 'thoothukudi(tuticorin)': 'thoothukudi', 'thoothukkudi': 'thoothukudi', 'tuticorn': 'thoothukudi',
      'kanchi': 'kanchipuram', 'kancheepuram': 'kanchipuram', 'kaanchipuram': 'kanchipuram',
      'kanniyakumari': 'kanyakumari', 'kk': 'kanyakumari', 'nagercoil': 'kanyakumari',
      'tanjore': 'thanjavur', 'thanjaavur': 'thanjavur', 'thanjur': 'thanjavur',
      'mathurai': 'madurai', 'maduai': 'madurai',
      'nellai': 'tirunelveli', 'thirunelveli': 'tirunelveli', 'tinnevelly': 'tirunelveli',
      'thiruvannamalai': 'tiruvannamalai', 'tiruvannamalai ': 'tiruvannamalai', 'thiruvannamalai ': 'tiruvannamalai',
      'selem': 'salem',
      'eerode': 'erode', 'eroad': 'erode',
      'vellur': 'vellore', 'velloor': 'vellore',
      'cudalur': 'cuddalore', 'cuddlore': 'cuddalore', 'kadalore': 'cuddalore',
      'dharmapuri ': 'dharmapuri', 'dharmaburi': 'dharmapuri',
      'krishnagri': 'krishnagiri', 'kirushnagiri': 'krishnagiri',
      'ramnad': 'ramanathapuram', 'ramnathapuram': 'ramanathapuram', 'ramanathpuram': 'ramanathapuram',
      'sivaganga': 'sivagangai', 'sivagagai': 'sivagangai',
      'villupuram': 'viluppuram', 'vizhuppuram': 'viluppuram', 'vilupuram': 'viluppuram',
      'virudunagar': 'virudhunagar', 'virudhunager': 'virudhunagar',
      'nilgiri': 'nilgiris', 'ooty': 'nilgiris', 'udhagai': 'nilgiris', 'neelagiri': 'nilgiris',
      'nagapatnam': 'nagapattinam', 'nagapatinam': 'nagapattinam',
      'mayuram': 'mayiladuthurai', 'mayiladhuthurai': 'mayiladuthurai',
      'thiruppur': 'tiruppur', 'tirupur': 'tiruppur',
      'thirupathur': 'tirupathur', 'tirupattur': 'tirupathur',
      'thiruvarur': 'tiruvarur', 'thiruvaroor': 'tiruvarur',
      'chengalpet': 'chengalpattu', 'chengalpatu': 'chengalpattu', 'chengalput': 'chengalpattu',
      'pudukottai': 'pudukkottai', 'pudukkotai': 'pudukkottai',
      'kalakurichi': 'kallakurichi', 'kallakurchi': 'kallakurichi',
      'ranipettai': 'ranipet',
      'perambaloor': 'perambalur',
      'dindugal': 'dindigul', 'dindukkal': 'dindigul',
      'namakal': 'namakkal',
      'karoor': 'karur',
      'thenkasi': 'tenkasi',
      'theni ': 'theni',
      'ariyaloor': 'ariyalur',
    };
    Object.entries(districtAliases).forEach(([alias, id]) => {
      districtLookup[alias.trim().toLowerCase()] = id;
    });

    function parseDistrictField(val) {
      if (!val) return { district: '', constituency: '' };
      const match = val.match(/^([^(]+?)(?:\s*\(([^)]+)\))?\s*$/);
      if (match) {
        return { district: match[1].trim(), constituency: match[2] ? match[2].trim() : '' };
      }
      return { district: val.trim(), constituency: '' };
    }

    const errors = [];
    const skipped = [];
    const validEntries = [];
    let lastDistrict = '';
    let lastDate = '';
    let lastTime = '';
    let lastSource = '';

    // Load existing entries for duplicate check
    const existingEntries = await Entry.find({}, { districtId: 1, entryDate: 1, gist: 1, newsLink: 1 }).lean();
    const existingSet = new Set();
    existingEntries.forEach(e => {
      existingSet.add(`${e.districtId}||${e.entryDate}||${e.gist}||${e.newsLink}`);
    });

    for (let i = 0; i < rows2.length; i++) {
      const row = rows2[i];
      const mapped = {};

      for (const [col, val] of Object.entries(row)) {
        const key = knownMap[col.toLowerCase().trim()];
        if (key) {
          mapped[key] = String(val).trim();
        }
      }

      if (mapped.districtId) lastDistrict = mapped.districtId;
      else mapped.districtId = lastDistrict;

      if (mapped.entryDate) lastDate = mapped.entryDate;
      else mapped.entryDate = lastDate;

      if (mapped.entryTime) lastTime = mapped.entryTime;
      else mapped.entryTime = lastTime;

      if (mapped.sourceOfComplaint) lastSource = mapped.sourceOfComplaint;
      else mapped.sourceOfComplaint = lastSource;

      if (!mapped.gist && !mapped.newsLink && !mapped.districtId) continue;

      let parsedConstituency = mapped.constituency || '';
      if (mapped.districtId) {
        const parsed = parseDistrictField(mapped.districtId);
        mapped.districtId = parsed.district;
        if (parsed.constituency && !parsedConstituency) {
          parsedConstituency = parsed.constituency;
        }
      }

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

      if (!mapped.gist && mapped.newsLink) {
        mapped.gist = mapped.newsLink;
      }

      if (!mapped.gist) {
        errors.push(`Row ${i + 1}: Gist/Content is missing`);
        continue;
      }

      const formattedDate = formatDate(mapped.entryDate) || '';
      const dupeKey = `${mapped.districtId}||${formattedDate}||${mapped.gist}||${mapped.newsLink || ''}`;
      if (existingSet.has(dupeKey)) {
        skipped.push(`Row ${i + 1}: Duplicate, skipped`);
        continue;
      }
      existingSet.add(dupeKey);

      mapped.constituency = parsedConstituency;

      validEntries.push({
        mediaType,
        newsLink: mapped.newsLink || '',
        entryDate: formatDate(mapped.entryDate) || new Date().toISOString().split('T')[0],
        entryTime: mapped.entryTime || new Date().toTimeString().slice(0, 5),
        districtId: mapped.districtId,
        constituency: mapped.constituency || '',
        gist: mapped.gist,
        sourceOfComplaint: mapped.sourceOfComplaint || '',
        addedBy: 'Admin',
        category: '',
        status: 'Pending',
        immediateReply: '',
        repliedLink: '',
        finalReply: '',
        evidencePhotos: [],
        extraData: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Atomically get the starting counter value
    const counter = await Counter.findOneAndUpdate(
      { _id: GLOBAL_COUNTER },
      { $inc: { count: validEntries.length } },
      { new: true, upsert: true }
    );

    const startSno = counter.count - validEntries.length;
    const created = [];

    // Assign sno and complaintId, then bulk insert
    const docsToInsert = validEntries.map((entry, idx) => {
      const sno = startSno + idx + 1;
      entry.sno = sno;
      entry.complaintId = prefix + '-' + String(sno).padStart(3, '0');
      created.push(entry.complaintId);
      return entry;
    });

    if (docsToInsert.length > 0) {
      await Entry.insertMany(docsToInsert);
    }

    invalidateStatsCache();
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

// POST /api/entries/sync-counter - sync counter with actual max sno (admin only)
router.post('/sync-counter', requireAdmin, async (req, res) => {
  try {
    const result = await Entry.aggregate([{ $group: { _id: null, maxSno: { $max: '$sno' } } }]);
    const maxSno = result.length > 0 ? result[0].maxSno : 0;

    const counterDoc = await Counter.findById(GLOBAL_COUNTER);
    const oldCount = counterDoc ? counterDoc.count : 0;

    await Counter.findOneAndUpdate(
      { _id: GLOBAL_COUNTER },
      { count: maxSno },
      { upsert: true }
    );

    const totalEntries = await Entry.countDocuments();

    res.json({
      message: 'Counter synced.',
      previousCount: oldCount,
      newCount: maxSno,
      totalEntries
    });
  } catch (err) {
    console.error('Sync counter error:', err);
    res.status(500).json({ error: 'Failed to sync counter.' });
  }
});

// POST /api/entries/resequence - renumber all entries sequentially (admin only)
router.post('/resequence', requireAdmin, async (req, res) => {
  try {
    const allEntries = await Entry.find().sort({ createdAt: 1 }).lean();

    if (allEntries.length === 0) {
      await Counter.findOneAndUpdate({ _id: GLOBAL_COUNTER }, { count: 0 }, { upsert: true });
      return res.json({ message: 'No entries to resequence.', totalEntries: 0, newCount: 0 });
    }

    const bulkOps = allEntries.map((entry, idx) => {
      const newSno = idx + 1;
      const mt = entry.mediaType || 'social_media';
      const pfx = MEDIA_TYPE_PREFIX[mt] || 'SM';
      const newComplaintId = pfx + '-' + String(newSno).padStart(3, '0');
      return {
        updateOne: {
          filter: { _id: entry._id },
          update: { $set: { sno: newSno, complaintId: newComplaintId, updatedAt: new Date().toISOString() } }
        }
      };
    });

    await Entry.bulkWrite(bulkOps);
    await Counter.findOneAndUpdate({ _id: GLOBAL_COUNTER }, { count: allEntries.length }, { upsert: true });

    res.json({
      message: `Resequenced ${allEntries.length} entries globally.`,
      totalEntries: allEntries.length,
      newCount: allEntries.length
    });
  } catch (err) {
    console.error('Resequence error:', err);
    res.status(500).json({ error: 'Failed to resequence entries.' });
  }
});

// PUT /api/entries/:id - edit entry (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { newsLink, entryDate, entryTime, districtId, gist, sourceOfComplaint, mediaType,
            immediateReply, finalReply, repliedLink, remark, status, category } = req.body;

    const entry = await Entry.findById(id);
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    const updates = {};
    if (newsLink !== undefined) updates.newsLink = newsLink;
    if (entryDate !== undefined) updates.entryDate = entryDate;
    if (entryTime !== undefined) updates.entryTime = entryTime;
    if (districtId !== undefined) updates.districtId = districtId;
    if (gist !== undefined) updates.gist = gist;
    if (sourceOfComplaint !== undefined) updates.sourceOfComplaint = sourceOfComplaint;
    if (immediateReply !== undefined) updates.immediateReply = immediateReply;
    if (finalReply !== undefined) updates.finalReply = finalReply;
    if (repliedLink !== undefined) updates.repliedLink = repliedLink;
    if (remark !== undefined) updates.remark = remark;
    if (category !== undefined) updates.category = category;
    if (status !== undefined && ['Pending', 'Replied', 'Closed', 'Dropped'].includes(status)) updates.status = status;
    if (mediaType !== undefined) {
      const prefix = MEDIA_TYPE_PREFIX[mediaType];
      if (!prefix) return res.status(400).json({ error: 'Invalid media type.' });
      updates.mediaType = mediaType;
      updates.complaintId = prefix + '-' + String(entry.sno).padStart(3, '0');
    }
    updates.updatedAt = new Date().toISOString();

    await Entry.findByIdAndUpdate(id, updates);
    invalidateStatsCache();
    res.json({ message: 'Entry updated successfully.', ...updates });
  } catch (err) {
    console.error('Update entry error:', err);
    res.status(500).json({ error: 'Failed to update entry.' });
  }
});

// DELETE /api/entries/:id - delete entry (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Entry.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    await deleteEntryPhotos(id);
    await Entry.findByIdAndDelete(id);
    // Note: no resequence on delete to save CPU. Use the /resequence endpoint manually if needed.

    invalidateStatsCache();
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

    const doc = await Entry.findById(id);
    if (!doc) return res.status(404).json({ error: 'Entry not found.' });

    await Entry.findByIdAndUpdate(id, { entryTime, updatedAt: new Date().toISOString() });
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

    const doc = await Entry.findById(id);
    if (!doc) return res.status(404).json({ error: 'Entry not found.' });

    if (doc.districtId !== user.districtId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (!constituency || !constituency.trim()) {
      return res.status(400).json({ error: 'Constituency is required.' });
    }

    await Entry.findByIdAndUpdate(id, { constituency, updatedAt: new Date().toISOString() });
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

    const doc = await Entry.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    if (doc.status === 'Closed' || doc.status === 'Dropped') {
      return res.status(400).json({ error: 'Cannot edit remarks on closed or dropped entries.' });
    }

    if (user.role === 'district' && doc.districtId !== user.districtId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    await Entry.findByIdAndUpdate(id, { remark, updatedAt: new Date().toISOString() });
    res.json({ message: 'Remark updated.' });
  } catch (err) {
    console.error('Update remark error:', err);
    res.status(500).json({ error: 'Failed to update remark.' });
  }
});

// PUT /api/entries/:id/immediate-reply - submit immediate reply (district or admin)
router.put('/:id/immediate-reply', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { immediateReply } = req.body;
    const user = req.user;

    const doc = await Entry.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    if (user.role === 'district' && doc.districtId !== user.districtId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (doc.status !== 'Pending') {
      return res.status(400).json({ error: 'Immediate reply can only be submitted for pending entries.' });
    }

    if (!immediateReply || !immediateReply.trim()) {
      return res.status(400).json({ error: 'Immediate reply cannot be empty.' });
    }

    await Entry.findByIdAndUpdate(id, {
      immediateReply,
      status: 'Replied',
      updatedAt: new Date().toISOString()
    });

    invalidateStatsCache();
    res.json({ message: 'Immediate reply submitted. Status changed to Replied.' });
  } catch (err) {
    console.error('Immediate reply error:', err);
    res.status(500).json({ error: 'Failed to submit immediate reply.' });
  }
});

// PUT /api/entries/:id/drop - drop an entry (admin only)
router.put('/:id/drop', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can drop entries.' });
    }

    const doc = await Entry.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    if (doc.status !== 'Pending' && doc.status !== 'Replied') {
      return res.status(400).json({ error: 'Only pending or replied entries can be dropped.' });
    }

    await Entry.findByIdAndUpdate(id, {
      status: 'Dropped',
      updatedAt: new Date().toISOString()
    });

    invalidateStatsCache();
    res.json({ message: 'Entry dropped successfully.' });
  } catch (err) {
    console.error('Drop entry error:', err);
    res.status(500).json({ error: 'Failed to drop entry.' });
  }
});

// PUT /api/entries/:id/final-reply - submit final reply with evidence (district or admin)
router.put('/:id/final-reply', requireAuth, upload.array('photos', 50), async (req, res) => {
  try {
    const { id } = req.params;
    const { finalReply, repliedLink } = req.body;
    const user = req.user;

    const doc = await Entry.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    if (user.role === 'district' && doc.districtId !== user.districtId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const entryMediaType = doc.mediaType || 'social_media';
    const allowedStatuses = entryMediaType === 'social_media' ? ['Replied'] : ['Pending', 'Replied'];
    if (!allowedStatuses.includes(doc.status)) {
      return res.status(400).json({ error: 'Final reply can only be submitted for replied entries.' });
    }

    if (!finalReply || !finalReply.trim()) {
      return res.status(400).json({ error: 'Final reply cannot be empty.' });
    }

    if (entryMediaType === 'social_media' && user.role === 'district' && (!repliedLink || !repliedLink.trim())) {
      return res.status(400).json({ error: 'Replied Link is required for Social Media entries.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one evidence photo is required.' });
    }

    const photoUrls = await Promise.all(
      req.files.map(file => uploadPhoto(file.buffer, file.originalname, id))
    );

    await Entry.findByIdAndUpdate(id, {
      finalReply,
      repliedLink: repliedLink || '',
      evidencePhotos: photoUrls,
      status: 'Closed',
      updatedAt: new Date().toISOString()
    });

    invalidateStatsCache();
    res.json({ message: 'Final reply submitted with evidence. Entry closed.' });
  } catch (err) {
    console.error('Final reply error:', err);
    res.status(500).json({ error: 'Failed to submit final reply.' });
  }
});

// PUT /api/entries/:id/add-evidence - admin can add evidence photos to any entry
router.put('/:id/add-evidence', requireAdmin, upload.array('photos', 50), async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await Entry.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one evidence file is required.' });
    }

    const photoUrls = await Promise.all(
      req.files.map(file => uploadPhoto(file.buffer, file.originalname, id))
    );

    const existingPhotos = doc.evidencePhotos || [];
    await Entry.findByIdAndUpdate(id, {
      evidencePhotos: [...existingPhotos, ...photoUrls],
      updatedAt: new Date().toISOString()
    });

    invalidateStatsCache();
    res.json({ message: 'Evidence added successfully.' });
  } catch (err) {
    console.error('Add evidence error:', err);
    res.status(500).json({ error: 'Failed to add evidence.' });
  }
});

// PUT /api/entries/:id/news-images - upload news images to Cloudinary
router.put('/:id/news-images', requireAuth, upload.array('newsImages', 10), async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Entry.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Entry not found.' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one image is required.' });
    }
    const imageUrls = await Promise.all(
      req.files.map(file => uploadPhoto(file.buffer, file.originalname, `${id}-news`))
    );
    const existing = doc.newsImages || [];
    await Entry.findByIdAndUpdate(id, {
      newsImages: [...existing, ...imageUrls],
      updatedAt: new Date().toISOString()
    });
    invalidateStatsCache();
    res.json({ message: 'News images uploaded successfully.', newsImages: [...existing, ...imageUrls] });
  } catch (err) {
    console.error('News images upload error:', err);
    res.status(500).json({ error: 'Failed to upload news images.' });
  }
});

// GET /api/entries/backup - download full backup as JSON (admin only)
router.get('/backup', requireAdmin, async (req, res) => {
  try {
    const entries = await Entry.find().lean();
    const mappedEntries = entries.map(e => ({ id: e._id.toString(), ...e, _id: undefined }));

    const counters = {};
    const counterDocs = await Counter.find().lean();
    counterDocs.forEach(doc => { counters[doc._id] = { count: doc.count }; });

    const backup = {
      exportedAt: new Date().toISOString(),
      totalEntries: entries.length,
      counters,
      entries: mappedEntries
    };

    const filename = `mongodb-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(backup);
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: 'Failed to create backup.' });
  }
});

module.exports = router;
