/**
 * reset-tickets.js
 *
 * Clears all ticket-related data from the database in preparation for the
 * rebrand from NBTC → Global Hoops (GH26-XXXXXX ticket ID prefix).
 *
 * Deletes:
 *   - tickets          (QR-coded individual tickets)
 *   - orders           (purchase records)
 *   - ticketreservations (seat holds)
 *   - counters         (resets sequential ticket ID counter to 0)
 *
 * Games, ticket types, teams, admins, and report recipients are NOT affected.
 *
 * Usage:
 *   node scripts/reset-tickets.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI is not set in .env');
  process.exit(1);
}

async function run() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.\n');

  const db = mongoose.connection.db;

  const collections = await db.listCollections().toArray();
  const names = collections.map((c) => c.name);

  async function dropIfExists(name) {
    if (names.includes(name)) {
      const result = await db.collection(name).deleteMany({});
      console.log(`  ✓ ${name}: ${result.deletedCount} document(s) deleted`);
    } else {
      console.log(`  – ${name}: collection not found, skipping`);
    }
  }

  console.log('Clearing ticket data…');
  await dropIfExists('tickets');
  await dropIfExists('orders');
  await dropIfExists('ticketreservations');

  console.log('\nResetting ticket ID counter…');
  if (names.includes('counters')) {
    const result = await db.collection('counters').updateOne(
      { _id: 'ticketId' },
      { $set: { seq: 0 } }
    );
    if (result.matchedCount === 0) {
      console.log('  – counter not found (will be created on first ticket generation)');
    } else {
      console.log('  ✓ counters.ticketId reset to 0');
    }
  } else {
    console.log('  – counters collection not found, skipping');
  }

  console.log('\nDone. Ticket IDs will now start from GH26-000001.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
