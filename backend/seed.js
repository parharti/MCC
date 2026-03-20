/**
 * Seed Script
 * Run with: node seed.js
 * Creates admin and district officer users in Firestore
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { db } = require('./config/firebase');
const { districts, districtPasswords } = require('./data/districts');

async function seed() {
  console.log('Seeding database...\n');

  // Create admin user
  const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
  await db.collection('users').doc('admin').set({
    role: 'admin',
    username: 'admin',
    password: adminHash
  });
  console.log('Created admin user');

  // Create district users
  for (const district of districts) {
    const hash = await bcrypt.hash(districtPasswords[district.id], 10);
    await db.collection('users').doc(district.id).set({
      role: 'district',
      username: district.name,
      districtId: district.id,
      districtName: district.name,
      password: hash
    });
    console.log(`Created ${district.name} user`);
  }

  // Initialize entry counter
  await db.collection('counters').doc('entries').set({ count: 0 });
  console.log('\nInitialized entry counter');

  console.log('\nSeeding complete!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
