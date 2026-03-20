/**
 * Seed Script
 * Run with: node seed.js
 * Creates admin and district officer users in Firestore
 */

require('dotenv').config();
const { db } = require('./config/firebase');
const { districts, districtPasswords } = require('./data/districts');

async function seed() {
  console.log('Seeding database...\n');

  // Create admin user
  await db.collection('users').doc('admin').set({
    role: 'admin',
    username: 'admin',
    password: process.env.ADMIN_PASSWORD
  });
  console.log('Created admin user');

  // Create district users
  for (const district of districts) {
    await db.collection('users').doc(district.id).set({
      role: 'district',
      username: district.name,
      districtId: district.id,
      districtName: district.name,
      password: districtPasswords[district.id]
    });
    console.log(`Created ${district.name} user (password: ${districtPasswords[district.id]})`);
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
