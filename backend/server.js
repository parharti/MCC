require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { connectDB, getConnectionStatus } = require('./config/mongodb');

const authRoutes = require('./routes/auth');
const entryRoutes = require('./routes/entries');
const reportRoutes = require('./routes/reports');
const districtRoutes = require('./routes/districts');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded photos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/districts', districtRoutes);

// Health check
app.get('/api/health', (req, res) => {
  const { isConnected, connectError } = getConnectionStatus();
  res.json({ status: 'ok', timestamp: new Date().toISOString(), mongoOk: isConnected, mongoError: connectError });
});

// Connect to MongoDB then start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`ECI Media Monitoring Backend running on port ${PORT}`);
  });
});
