const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectDB, getConnectionStatus } = require('../backend/config/mongodb');

const app = express();

app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB before handling requests
let dbReady = connectDB();

app.use(async (req, res, next) => {
  await dbReady;
  next();
});

app.get('/api/health', (req, res) => {
  const { isConnected, connectError } = getConnectionStatus();
  res.json({ status: 'ok', timestamp: new Date().toISOString(), mongoOk: isConnected, mongoError: connectError });
});

const authRoutes = require('../backend/routes/auth');
const entryRoutes = require('../backend/routes/entries');
const reportRoutes = require('../backend/routes/reports');
const districtRoutes = require('../backend/routes/districts');
app.use('/api/auth', authRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/districts', districtRoutes);

module.exports = app;
