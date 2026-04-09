const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
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
      const adminDoc = await User.findById('admin');
      if (!adminDoc) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      const adminMatch = await bcrypt.compare(password, adminDoc.password);
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
      const district = districts.find(d => d.id === districtId);
      if (!district) {
        return res.status(400).json({ error: 'Invalid district.' });
      }
      const districtDoc = await User.findById(districtId);
      if (!districtDoc) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      const districtMatch = await bcrypt.compare(password, districtDoc.password);
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
    const { iat, exp, ...user } = decoded;
    return res.json({ user });
  } catch (err) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
});

// PUT /api/auth/change-password (district officers and admin)
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

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  const userId = user.role === 'admin' ? 'admin' : user.districtId;

  try {
    const doc = await User.findById(userId);
    if (!doc) return res.status(404).json({ error: 'User not found.' });

    const isMatch = await bcrypt.compare(currentPassword, doc.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const hashedNew = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(userId, { password: hashedNew });
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

module.exports = router;
