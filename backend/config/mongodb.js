const mongoose = require('mongoose');

let isConnected = false;
let connectError = null;

async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    connectError = 'MONGODB_URI not set';
    console.error('MongoDB init error:', connectError);
    return;
  }

  try {
    await mongoose.connect(uri);
    isConnected = true;
    connectError = null;
    console.log('MongoDB connected');
  } catch (err) {
    connectError = err.message;
    console.error('MongoDB connection error:', err.message);
  }
}

function getConnectionStatus() {
  return { isConnected, connectError };
}

module.exports = { connectDB, getConnectionStatus };
