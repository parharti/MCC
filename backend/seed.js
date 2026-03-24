/**
 * Seed Script
 * Run with: node seed.js
 * Creates admin and district officer users in MongoDB
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Counter = require('./models/Counter');
const { districts, districtPasswords } = require('./data/districts');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');
  console.log('Seeding database...\n');

  // Create admin user
  const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
  await User.findOneAndUpdate(
    { _id: 'admin' },
    { _id: 'admin', role: 'admin', username: 'admin', password: adminHash },
    { upsert: true }
  );
  console.log('Created admin user');

  // Create district users
  for (const district of districts) {
    const hash = await bcrypt.hash(districtPasswords[district.id], 10);
    await User.findOneAndUpdate(
      { _id: district.id },
      {
        _id: district.id,
        role: 'district',
        username: district.name,
        districtId: district.id,
        districtName: district.name,
        password: hash
      },
      { upsert: true }
    );
    console.log(`Created ${district.name} user`);
  }

  // Initialize entry counter
  await Counter.findOneAndUpdate(
    { _id: 'entries' },
    { _id: 'entries', count: 0 },
    { upsert: true }
  );
  console.log('\nInitialized entry counter');

  console.log('\nSeeding complete!');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
