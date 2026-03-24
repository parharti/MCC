/**
 * Migration Script: Firestore → MongoDB
 * Copies all data from Firestore to MongoDB Atlas WITHOUT deleting anything from Firestore.
 * Run with: node migrate-to-mongo.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { db } = require('./config/firebase');
const User = require('./models/User');
const Entry = require('./models/Entry');
const Counter = require('./models/Counter');

async function migrate() {
  // Connect to MongoDB
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');

  // 1. Migrate users
  console.log('--- Migrating Users ---');
  const usersSnap = await db.collection('users').get();
  let userCount = 0;
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    await User.findOneAndUpdate(
      { _id: doc.id },
      { _id: doc.id, ...data },
      { upsert: true, new: true }
    );
    console.log(`  Migrated user: ${doc.id} (${data.role})`);
    userCount++;
  }
  console.log(`Users migrated: ${userCount}\n`);

  // 2. Migrate entries
  console.log('--- Migrating Entries ---');
  const entriesSnap = await db.collection('entries').get();
  let entryCount = 0;
  for (const doc of entriesSnap.docs) {
    const data = doc.data();
    await Entry.findOneAndUpdate(
      { complaintId: data.complaintId },
      data,
      { upsert: true, new: true }
    );
    entryCount++;
    if (entryCount % 50 === 0) console.log(`  Migrated ${entryCount} entries...`);
  }
  console.log(`Entries migrated: ${entryCount}\n`);

  // 3. Migrate counters
  console.log('--- Migrating Counters ---');
  const countersSnap = await db.collection('counters').get();
  let counterCount = 0;
  for (const doc of countersSnap.docs) {
    const data = doc.data();
    await Counter.findOneAndUpdate(
      { _id: doc.id },
      { _id: doc.id, ...data },
      { upsert: true, new: true }
    );
    console.log(`  Migrated counter: ${doc.id} (count: ${data.count})`);
    counterCount++;
  }
  console.log(`Counters migrated: ${counterCount}\n`);

  console.log('=== Migration complete! ===');
  console.log(`Total: ${userCount} users, ${entryCount} entries, ${counterCount} counters`);
  console.log('Firestore data was NOT modified or deleted.');

  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
