const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db } = require('../config/firebase');
const { districts } = require('../data/districts');

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'eci-tn-secret-2026';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { role, districtId, password } = req.body;

    if (!role || !password) {
      return res.status(400).json({ error: 'Role and password are required.' });
    }

    if (role === 'admin') {
      // Check admin credentials
      const adminDoc = await db.collection('users').doc('admin').get();
      if (!adminDoc.exists) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      const adminData = adminDoc.data();
      const adminMatch = await bcrypt.compare(password, adminData.password);
      if (!adminMatch) {
        return res.status(401).json({ error: 'Invalid password.' });
      }
      const user = { role: 'admin', username: 'admin' };
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
      return res.json({ user, token });
    }

    if (role === 'district') {
      if (!districtId) {
        return res.status(400).json({ error: 'District selection is required.' });
      }
      // Validate district exists
      const district = districts.find(d => d.id === districtId);
      if (!district) {
        return res.status(400).json({ error: 'Invalid district.' });
      }
      // Check district credentials
      const districtDoc = await db.collection('users').doc(districtId).get();
      if (!districtDoc.exists) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      const districtData = districtDoc.data();
      const districtMatch = await bcrypt.compare(password, districtData.password);
      if (!districtMatch) {
        return res.status(401).json({ error: 'Invalid password.' });
      }
      const user = {
        role: 'district',
        districtId: districtId,
        districtName: district.name,
        username: district.name
      };
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
      return res.json({ user, token });
    }

    return res.status(400).json({ error: 'Invalid role.' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  // With JWT, logout is handled client-side by removing the token
  res.json({ message: 'Logged out successfully.' });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Remove JWT metadata fields before returning user
    const { iat, exp, ...user } = decoded;
    return res.json({ user });
  } catch (err) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
});

// PUT /api/auth/change-password (district officers only)
router.put('/change-password', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  const token = authHeader.split(' ')[1];
  let user;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { iat, exp, ...u } = decoded;
    user = u;
  } catch {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  if (user.role !== 'district') {
    return res.status(403).json({ error: 'Only district officers can change password.' });
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  try {
    const doc = await db.collection('users').doc(user.districtId).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found.' });

    const isMatch = await bcrypt.compare(currentPassword, doc.data().password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const hashedNew = await bcrypt.hash(newPassword, 10);
    await db.collection('users').doc(user.districtId).update({ password: hashedNew });
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

module.exports = router;
