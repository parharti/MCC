const express = require('express');
const router = express.Router();
const multer = require('multer');
const { db } = require('../config/firebase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { uploadPhoto, deleteEntryPhotos } = require('../services/storageService');
const XLSX = require('xlsx');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Stats cache - avoids reading all entries on every dashboard poll
let statsCache = { data: null, timestamp: 0 };
const STATS_CACHE_TTL = 15000; // 15 seconds
function invalidateStatsCache() { statsCache = { data: null, timestamp: 0 }; }

const MEDIA_TYPE_PREFIX = {
  social_media: 'SM',
  print_media: 'PM',
  electronic_media: 'EM',
};
const GLOBAL_COUNTER = 'entries';

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

    // Filter by mediaType if specified
    const mediaTypeFilter = req.query.mediaType;
    const filtered = mediaTypeFilter
      ? entries.filter(e => (e.mediaType || 'social_media') === mediaTypeFilter)
      : entries;

    // Sort client-side to avoid composite index requirement
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ entries: filtered });
  } catch (err) {
    console.error('Get entries error:', err);
    res.status(500).json({ error: 'Failed to fetch entries.' });
  }
});

// GET /api/entries/stats - dashboard analytics (cached)
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const cacheNow = Date.now();

    let allEntries;
    if (statsCache.data && (cacheNow - statsCache.timestamp) < STATS_CACHE_TTL) {
      allEntries = statsCache.data;
    } else {
      const snapshot = await db.collection('entries').get();
      allEntries = [];
      snapshot.forEach(doc => allEntries.push(doc.data()));
      statsCache = { data: allEntries, timestamp: cacheNow };
    }

    const now = new Date();
    const TWENTY_FOUR_HRS = 24 * 60 * 60 * 1000;

    if (user.role === 'admin') {
      // District-wise breakdown for admin (with per-media-type status)
      const emptyMediaStats = () => ({ total: 0, pending: 0, replied: 0, closed: 0, overdue: 0 });
      const districtStats = {};
      allEntries.forEach(entry => {
        const did = entry.districtId;
        if (!districtStats[did]) {
          districtStats[did] = {
            ...emptyMediaStats(),
            social_media: emptyMediaStats(),
            print_media: emptyMediaStats(),
            electronic_media: emptyMediaStats()
          };
        }
        const ds = districtStats[did];
        const mt = entry.mediaType || 'social_media';
        const mds = ds[mt] || ds.social_media;

        // Overall district totals
        ds.total++;
        if (entry.status === 'Pending') ds.pending++;
        else if (entry.status === 'Replied') ds.replied++;
        else if (entry.status === 'Closed') ds.closed++;
        if (entry.status !== 'Closed' && (now - new Date(entry.createdAt)) >= TWENTY_FOUR_HRS) {
          ds.overdue++;
        }

        // Per media type totals
        mds.total++;
        if (entry.status === 'Pending') mds.pending++;
        else if (entry.status === 'Replied') mds.replied++;
        else if (entry.status === 'Closed') mds.closed++;
        if (entry.status !== 'Closed' && (now - new Date(entry.createdAt)) >= TWENTY_FOUR_HRS) {
          mds.overdue++;
        }
      });

      const overall = {
        total: allEntries.length,
        pending: allEntries.filter(e => e.status === 'Pending').length,
        replied: allEntries.filter(e => e.status === 'Replied').length,
        closed: allEntries.filter(e => e.status === 'Closed').length,
        overdue: allEntries.filter(e => e.status !== 'Closed' && (now - new Date(e.createdAt)) >= TWENTY_FOUR_HRS).length
      };

      // Media type breakdown
      const mediaTypeStats = { social_media: { total: 0 }, print_media: { total: 0 }, electronic_media: { total: 0 } };
      allEntries.forEach(entry => {
        const mt = entry.mediaType || 'social_media';
        if (mediaTypeStats[mt]) mediaTypeStats[mt].total++;
      });

      res.json({ overall, districtStats, mediaTypeStats });
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
      const mediaTypeStats = { social_media: { total: 0 }, print_media: { total: 0 }, electronic_media: { total: 0 } };
      myEntries.forEach(entry => {
        const mt = entry.mediaType || 'social_media';
        if (mediaTypeStats[mt]) mediaTypeStats[mt].total++;
      });
      res.json({ overall: stats, districtStats: {}, mediaTypeStats });
    }
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

// POST /api/entries - create new entry (admin and district users)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { newsLink, entryDate, entryTime, districtId: bodyDistrictId, constituency, gist, sourceOfComplaint, mediaType: reqMediaType } = req.body;

    const mediaType = reqMediaType || 'social_media';

    // District users can only add entries for their own district
    const districtId = req.user.role === 'district' ? req.user.districtId : bodyDistrictId;

    if (!entryDate || !districtId || !gist || !sourceOfComplaint) {
      return res.status(400).json({ error: 'All fields except News Link and Constituency are required.' });
    }
    if (mediaType === 'social_media' && !entryTime) {
      return res.status(400).json({ error: 'Time is required for Social Media entries.' });
    }
    const prefix = MEDIA_TYPE_PREFIX[mediaType];
    if (!prefix) {
      return res.status(400).json({ error: 'Invalid media type.' });
    }

    // Auto-generate complaint ID using a Firestore transaction to prevent race conditions
    // Global counter shared across all media types
    const result = await db.runTransaction(async (t) => {
      const counterRef = db.collection('counters').doc(GLOBAL_COUNTER);
      const counterSnap = await t.get(counterRef);
      const counterVal = counterSnap.exists ? counterSnap.data().count : 0;

      let sno = counterVal + 1;
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
        status: 'Pending',
        remark: '',
        immediateReply: '',
        repliedLink: '',
        finalReply: '',
        evidencePhotos: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const entryRef = db.collection('entries').doc();
      t.set(entryRef, entryData);
      t.set(counterRef, { count: sno });

      return { id: entryRef.id, ...entryData };
    });

    invalidateStatsCache();
    res.status(201).json(result);
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

    // Counter will be read inside the transaction to prevent race conditions

    const { districts } = require('../data/districts');
    const districtLookup = {};
    districts.forEach(d => {
      districtLookup[d.name.toLowerCase()] = d.id;
      districtLookup[d.id] = d.id;
      districtLookup[d.code] = d.id;
      districtLookup[d.name.toLowerCase().replace(/\s+/g, '')] = d.id;
    });

    // Common alternate names, Tamil transliterations, abbreviations, and typos
    const districtAliases = {
      // Coimbatore
      'kovai': 'coimbatore', 'cbe': 'coimbatore', 'coimbathore': 'coimbatore', 'kovaai': 'coimbatore',
      // Tiruvallur
      'thiruvallur': 'tiruvallur', 'thirullavi': 'tiruvallur', 'thirullavar': 'tiruvallur', 'tiruvallore': 'tiruvallur',
      // Chennai
      'madras': 'chennai', 'chennnai': 'chennai', 'cennai': 'chennai',
      // Tiruchirappalli
      'trichy': 'tiruchirappalli', 'tiruchi': 'tiruchirappalli', 'trichirappalli': 'tiruchirappalli', 'tiruchy': 'tiruchirappalli', 'tiruchchirapalli': 'tiruchirappalli',
      // Thoothukudi
      'tuticorin': 'thoothukudi', 'thoothukudi(tuticorin)': 'thoothukudi', 'thoothukkudi': 'thoothukudi', 'tuticorn': 'thoothukudi',
      // Kanchipuram
      'kanchi': 'kanchipuram', 'kancheepuram': 'kanchipuram', 'kaanchipuram': 'kanchipuram',
      // Kanyakumari
      'kanniyakumari': 'kanyakumari', 'kk': 'kanyakumari', 'nagercoil': 'kanyakumari',
      // Thanjavur
      'tanjore': 'thanjavur', 'thanjaavur': 'thanjavur', 'thanjur': 'thanjavur',
      // Madurai
      'mathurai': 'madurai', 'maduai': 'madurai',
      // Tirunelveli
      'nellai': 'tirunelveli', 'thirunelveli': 'tirunelveli', 'tinnevelly': 'tirunelveli',
      // Tiruvannamalai
      'thiruvannamalai': 'tiruvannamalai', 'tiruvannamalai ': 'tiruvannamalai', 'thiruvannamalai ': 'tiruvannamalai',
      // Salem
      'selem': 'salem',
      // Erode
      'eerode': 'erode', 'eroad': 'erode',
      // Vellore
      'vellur': 'vellore', 'velloor': 'vellore',
      // Cuddalore
      'cudalur': 'cuddalore', 'cuddlore': 'cuddalore', 'kadalore': 'cuddalore',
      // Dharmapuri
      'dharmapuri ': 'dharmapuri', 'dharmaburi': 'dharmapuri',
      // Krishnagiri
      'krishnagri': 'krishnagiri', 'kirushnagiri': 'krishnagiri',
      // Ramanathapuram
      'ramnad': 'ramanathapuram', 'ramnathapuram': 'ramanathapuram', 'ramanathpuram': 'ramanathapuram',
      // Sivagangai
      'sivaganga': 'sivagangai', 'sivagagai': 'sivagangai',
      // Viluppuram
      'villupuram': 'viluppuram', 'vizhuppuram': 'viluppuram', 'vilupuram': 'viluppuram',
      // Virudhunagar
      'virudunagar': 'virudhunagar', 'virudhunager': 'virudhunagar',
      // Nilgiris
      'nilgiri': 'nilgiris', 'ooty': 'nilgiris', 'udhagai': 'nilgiris', 'neelagiri': 'nilgiris',
      // Nagapattinam
      'nagapatnam': 'nagapattinam', 'nagapatinam': 'nagapattinam',
      // Mayiladuthurai
      'mayuram': 'mayiladuthurai', 'mayiladhuthurai': 'mayiladuthurai',
      // Tiruppur
      'thiruppur': 'tiruppur', 'tirupur': 'tiruppur',
      // Tirupathur
      'thirupathur': 'tirupathur', 'tirupattur': 'tirupathur',
      // Tiruvarur
      'thiruvarur': 'tiruvarur', 'thiruvaroor': 'tiruvarur',
      // Chengalpattu
      'chengalpet': 'chengalpattu', 'chengalpatu': 'chengalpattu', 'chengalput': 'chengalpattu',
      // Pudukkottai
      'pudukottai': 'pudukkottai', 'pudukkotai': 'pudukkottai',
      // Kallakurichi
      'kalakurichi': 'kallakurichi', 'kallakurchi': 'kallakurichi',
      // Ranipet
      'ranipettai': 'ranipet',
      // Perambalur
      'perambaloor': 'perambalur',
      // Dindigul
      'dindugal': 'dindigul', 'dindukkal': 'dindigul',
      // Namakkal
      'namakal': 'namakkal',
      // Karur
      'karoor': 'karur',
      // Tenkasi
      'thenkasi': 'tenkasi',
      // Theni
      'theni ': 'theni',
      // Ariyalur
      'ariyaloor': 'ariyalur',
    };
    Object.entries(districtAliases).forEach(([alias, id]) => {
      districtLookup[alias.trim().toLowerCase()] = id;
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

    const errors = [];
    const skipped = [];
    const validEntries = [];
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

      // Format date before dupe check so it matches DB format (YYYY-MM-DD)
      const formattedDate = formatDate(mapped.entryDate) || '';
      const dupeKey = `${mapped.districtId}||${formattedDate}||${mapped.gist}||${mapped.newsLink || ''}`;
      if (existingSet.has(dupeKey)) {
        skipped.push(`Row ${i + 1}: Duplicate, skipped`);
        continue;
      }
      existingSet.add(dupeKey);

      // Store parsed constituency
      mapped.constituency = parsedConstituency;

      // Collect valid entry data (sno and complaintId assigned in transaction)
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

    // Write all valid entries using Firestore transactions for atomicity
    // Batch into groups of 400 to stay within the 500 write limit per transaction
    const BATCH_LIMIT = 400;
    const batches = [];
    for (let i = 0; i < validEntries.length; i += BATCH_LIMIT) {
      batches.push(validEntries.slice(i, i + BATCH_LIMIT));
    }

    const created = [];

    for (const batch of batches) {
      const result = await db.runTransaction(async (t) => {
        const counterRef = db.collection('counters').doc(GLOBAL_COUNTER);
        const counterSnap = await t.get(counterRef);
        const counterVal = counterSnap.exists ? counterSnap.data().count : 0;

        let sno = counterVal;

        const batchCreated = [];
        for (const entry of batch) {
          sno++;
          entry.sno = sno;
          entry.complaintId = prefix + '-' + String(sno).padStart(3, '0');
          const ref = db.collection('entries').doc();
          t.set(ref, entry);
          batchCreated.push(entry.complaintId);
        }
        t.set(counterRef, { count: sno });
        return batchCreated;
      });
      created.push(...result);
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

// POST /api/entries/sync-counter - sync counters per media type with actual max sno (admin only)
router.post('/sync-counter', requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('entries').get();
    let maxSno = 0;
    snapshot.forEach(doc => {
      const s = doc.data().sno || 0;
      if (s > maxSno) maxSno = s;
    });

    const counterRef = db.collection('counters').doc(GLOBAL_COUNTER);
    const counterSnap = await counterRef.get();
    const oldCount = counterSnap.exists ? counterSnap.data().count : 0;
    await counterRef.set({ count: maxSno });

    res.json({
      message: 'Counter synced.',
      previousCount: oldCount,
      newCount: maxSno,
      totalEntries: snapshot.size
    });
  } catch (err) {
    console.error('Sync counter error:', err);
    res.status(500).json({ error: 'Failed to sync counter.' });
  }
});

// POST /api/entries/resequence - renumber all entries sequentially with global counter (admin only)
router.post('/resequence', requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('entries').get();
    if (snapshot.empty) {
      await db.collection('counters').doc(GLOBAL_COUNTER).set({ count: 0 });
      return res.json({ message: 'No entries to resequence.', totalEntries: 0, newCount: 0 });
    }

    // Sort all entries by createdAt globally
    const allEntries = [];
    snapshot.forEach(doc => allEntries.push({ id: doc.id, ...doc.data() }));
    allEntries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const BATCH_LIMIT = 400;
    for (let i = 0; i < allEntries.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      const chunk = allEntries.slice(i, i + BATCH_LIMIT);
      for (let j = 0; j < chunk.length; j++) {
        const entry = chunk[j];
        const newSno = i + j + 1;
        const mt = entry.mediaType || 'social_media';
        const pfx = MEDIA_TYPE_PREFIX[mt] || 'SM';
        const newComplaintId = pfx + '-' + String(newSno).padStart(3, '0');
        batch.update(db.collection('entries').doc(entry.id), {
          sno: newSno,
          complaintId: newComplaintId,
          updatedAt: new Date().toISOString()
        });
      }
      await batch.commit();
    }

    await db.collection('counters').doc(GLOBAL_COUNTER).set({ count: allEntries.length });

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
    const { newsLink, entryDate, entryTime, districtId, gist, sourceOfComplaint, mediaType } = req.body;

    const entryRef = db.collection('entries').doc(id);
    const entrySnap = await entryRef.get();
    if (!entrySnap.exists) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    const updates = {};
    if (newsLink !== undefined) updates.newsLink = newsLink;
    if (entryDate !== undefined) updates.entryDate = entryDate;
    if (entryTime !== undefined) updates.entryTime = entryTime;
    if (districtId !== undefined) updates.districtId = districtId;
    if (gist !== undefined) updates.gist = gist;
    if (sourceOfComplaint !== undefined) updates.sourceOfComplaint = sourceOfComplaint;
    if (mediaType !== undefined) {
      const prefix = MEDIA_TYPE_PREFIX[mediaType];
      if (!prefix) return res.status(400).json({ error: 'Invalid media type.' });
      updates.mediaType = mediaType;
      // Update complaintId prefix
      const existing = entrySnap.data();
      updates.complaintId = prefix + '-' + String(existing.sno).padStart(3, '0');
    }
    updates.updatedAt = new Date().toISOString();

    await entryRef.update(updates);
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
    const doc = await db.collection('entries').doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    // Delete associated photos from storage
    await deleteEntryPhotos(id);
    await db.collection('entries').doc(id).delete();

    // Resequence all remaining entries globally so IDs stay continuous
    const remaining = await db.collection('entries').get();
    const entries = [];
    remaining.forEach(d => entries.push({ id: d.id, ...d.data() }));
    entries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const BATCH_LIMIT = 400;
    for (let i = 0; i < entries.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      const chunk = entries.slice(i, i + BATCH_LIMIT);
      for (let j = 0; j < chunk.length; j++) {
        const entry = chunk[j];
        const newSno = i + j + 1;
        const mt = entry.mediaType || 'social_media';
        const pfx = MEDIA_TYPE_PREFIX[mt] || 'SM';
        batch.update(db.collection('entries').doc(entry.id), {
          sno: newSno,
          complaintId: pfx + '-' + String(newSno).padStart(3, '0')
        });
      }
      await batch.commit();
    }
    await db.collection('counters').doc(GLOBAL_COUNTER).set({ count: entries.length });

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

    invalidateStatsCache();
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
    const { finalReply, repliedLink } = req.body;
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

    const entryMediaType = entry.mediaType || 'social_media';
    const allowedStatuses = entryMediaType === 'social_media' ? ['Replied'] : ['Pending', 'Replied'];
    if (!allowedStatuses.includes(entry.status)) {
      return res.status(400).json({ error: 'Final reply can only be submitted for replied entries.' });
    }

    if (!finalReply || !finalReply.trim()) {
      return res.status(400).json({ error: 'Final reply cannot be empty.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one evidence photo is required.' });
    }

    // Upload photos in parallel to avoid timeout
    const photoUrls = await Promise.all(
      req.files.map(file => uploadPhoto(file.buffer, file.originalname, id))
    );

    await db.collection('entries').doc(id).update({
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

// GET /api/entries/backup - download full backup as JSON (admin only)
router.get('/backup', requireAdmin, async (req, res) => {
  try {
    const entriesSnap = await db.collection('entries').get();
    const entries = [];
    entriesSnap.forEach(doc => entries.push({ id: doc.id, ...doc.data() }));

    const countersSnap = await db.collection('counters').get();
    const counters = {};
    countersSnap.forEach(doc => { counters[doc.id] = doc.data(); });

    const backup = {
      exportedAt: new Date().toISOString(),
      totalEntries: entries.length,
      counters,
      entries
    };

    const filename = `firebase-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(backup);
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: 'Failed to create backup.' });
  }
});

module.exports = router;
