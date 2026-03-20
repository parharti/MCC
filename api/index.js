const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { initError } = require('../backend/config/firebase');

const app = express();

app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), firebaseOk: !initError });
});

if (!initError) {
  const authRoutes = require('../backend/routes/auth');
  const entryRoutes = require('../backend/routes/entries');
  const reportRoutes = require('../backend/routes/reports');
  const districtRoutes = require('../backend/routes/districts');
  app.use('/api/auth', authRoutes);
  app.use('/api/entries', entryRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/districts', districtRoutes);
} else {
  const districtRoutes = require('../backend/routes/districts');
  app.use('/api/districts', districtRoutes);
  app.all('/api/*', (req, res) => {
    res.status(500).json({ error: 'Firebase not initialized: ' + initError });
  });
}

module.exports = app;
