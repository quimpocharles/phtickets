/**
 * seed-orders.js
 *
 * Creates mock paid orders directly in MongoDB, then processes each one via
 * the /payments/process dev bypass — so sold counts go down, QR codes are
 * generated, and email/SMS notifications fire exactly as in a real purchase.
 *
 * Requirements:
 *   • Backend server must be running on API_URL (default http://localhost:3000)
 *   • NODE_ENV=development must be set in .env (enables the Maya bypass)
 *
 * Usage:
 *   node scripts/seed-orders.js
 *   node scripts/seed-orders.js --game <gameId>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const axios    = require('axios');

const Game             = require('../src/models/Game');
const TicketType       = require('../src/models/TicketType');
const TicketReservation = require('../src/models/TicketReservation');

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────────────────────
// Configure mock buyers here.
// ticketTypeName: partial match against ticket type name (case-insensitive).
//                 Leave undefined to pick the first ticket type for the game.
// quantity: number of purchase units (NOT individual QR codes).
// ─────────────────────────────────────────────────────────────────────────────
// ── Badge thresholds (from web/src/lib/badges.ts) ────────────────────────────
// Sold Out        : available = 0
// Last Chance     : available / quantity ≤ 0.25
// Almost Sold-Out : available / quantity ≤ 0.50
// Fast-Selling    : available / quantity ≤ 0.75
// Trending        : sold ≥ 10
//
// Current state (from admin panel):
//   single day pass            — cap 100, sold  42, avail 58  → needs 33 more → "Last Chance to Buy"
//   family day pass (5 pax)   — cap 200, sold   4, avail 196 → needs  6 more → "Trending"
//   vip all events pass        — cap  50, sold   7, avail 43  → needs 43 more → "Sold Out"
//   vip family all events pass — cap  50, sold   1, avail 49  → needs 12 more → "Fast-Selling"
// ─────────────────────────────────────────────────────────────────────────────

const ORDERS = [
  // ── single day pass → "Last Chance to Buy" (≤25% avail) ──────────────────
  // Sell 33 more: 42 + 33 = 75 sold → 25 remaining = exactly 25% → last-chance
  { buyerName: 'Juan dela Cruz',    buyerEmail: 'juan@test.com',    buyerPhone: '09171234567', quantity: 11, ticketTypeName: 'single day pass' },
  { buyerName: 'Maria Santos',      buyerEmail: 'maria@test.com',   buyerPhone: '09281234567', quantity: 11, ticketTypeName: 'single day pass' },
  { buyerName: 'Pedro Reyes',       buyerEmail: 'pedro@test.com',   buyerPhone: '09391234567', quantity: 11, ticketTypeName: 'single day pass' },

  // ── family day pass (5 pax) → "Trending" (sold ≥ 10) ─────────────────────
  // Sell 6 more: 4 + 6 = 10 sold → triggers trending badge
  { buyerName: 'Ana Garcia',        buyerEmail: 'ana@test.com',     buyerPhone: '09451234567', quantity: 2, ticketTypeName: 'family day pass' },
  { buyerName: 'Jose Mendoza',      buyerEmail: 'jose@test.com',    buyerPhone: '09561234567', quantity: 2, ticketTypeName: 'family day pass' },
  { buyerName: 'Rosa Aquino',       buyerEmail: 'rosa@test.com',    buyerPhone: '09671234567', quantity: 2, ticketTypeName: 'family day pass' },

  // ── vip all events pass → "Sold Out" (available = 0) ─────────────────────
  // Sell 43 more: 7 + 43 = 50 sold → fully sold out
  { buyerName: 'Carlo Bautista',    buyerEmail: 'carlo@test.com',   buyerPhone: '09781234567', quantity: 15, ticketTypeName: 'vip all events pass' },
  { buyerName: 'Liza Gomez',        buyerEmail: 'liza@test.com',    buyerPhone: '09891234567', quantity: 15, ticketTypeName: 'vip all events pass' },
  { buyerName: 'Ramon Torres',      buyerEmail: 'ramon@test.com',   buyerPhone: '09171112222', quantity: 13, ticketTypeName: 'vip all events pass' },

  // ── vip family all events pass → "Fast-Selling" (≤75% avail) ────────────
  // Sell 12 more: 1 + 12 = 13 sold → 37 remaining = 74% avail → fast-selling
  { buyerName: 'Elena Villanueva',  buyerEmail: 'elena@test.com',   buyerPhone: '09282223333', quantity: 4, ticketTypeName: 'vip family all events' },
  { buyerName: 'Eduardo Lim',       buyerEmail: 'eduardo@test.com', buyerPhone: '09393334444', quantity: 4, ticketTypeName: 'vip family all events' },
  { buyerName: 'Patricia Ong',      buyerEmail: 'patricia@test.com',buyerPhone: '09404445555', quantity: 4, ticketTypeName: 'vip family all events' },
];

// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  if (process.env.NODE_ENV !== 'development') {
    console.error('ERROR: NODE_ENV must be "development" to use this script.');
    console.error('Add NODE_ENV=development to your .env file and restart.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  // ── Pick game ──────────────────────────────────────────────────────────────
  const gameIdArg = process.argv.find((a, i) => process.argv[i - 1] === '--game');
  const game = gameIdArg
    ? await Game.findById(gameIdArg)
    : await Game.findOne().sort({ gameDate: 1 });

  if (!game) {
    console.error('No game found. Create a game first via the admin panel.');
    process.exit(1);
  }

  const ticketTypes = await TicketType.find({ gameId: game._id });
  if (!ticketTypes.length) {
    console.error(`No ticket types found for game "${game.description}".`);
    process.exit(1);
  }

  console.log(`Game: ${game.description}`);
  console.log(`Ticket types:`);
  ticketTypes.forEach((tt) => {
    const available = tt.quantity - tt.sold;
    console.log(`  • ${tt.name} — ₱${tt.price} | sold: ${tt.sold}/${tt.quantity} | available: ${available}`);
  });
  console.log();

  // ── Process each mock order ────────────────────────────────────────────────
  let successCount = 0;
  let failCount    = 0;

  for (const buyer of ORDERS) {
    // Match ticket type by name fragment, or fall back to first type
    const ticketType = buyer.ticketTypeName
      ? ticketTypes.find((tt) => tt.name.toLowerCase().includes(buyer.ticketTypeName.toLowerCase()))
      : ticketTypes[0];

    if (!ticketType) {
      console.warn(`  [SKIP] No ticket type matching "${buyer.ticketTypeName}" for ${buyer.buyerName}`);
      failCount++;
      continue;
    }

    const available = ticketType.quantity - ticketType.sold;
    if (buyer.quantity > available) {
      console.warn(`  [SKIP] Not enough tickets for ${buyer.buyerName} (wants ${buyer.quantity}, available ${available})`);
      failCount++;
      continue;
    }

    // Create reservation directly — use a fake checkoutId so /process can
    // attempt Maya verification (which will fail with K007 and be bypassed
    // in dev mode).
    const reservation = await TicketReservation.create({
      gameId:       game._id,
      ticketTypeId: ticketType._id,
      quantity:     buyer.quantity,
      buyerEmail:   buyer.buyerEmail,
      buyerPhone:   buyer.buyerPhone,
      buyerName:    buyer.buyerName ?? null,
      status:       'reserved',
      checkoutId:   `seed-${Date.now()}`,
      expiresAt:    new Date(Date.now() + 30 * 60 * 1000),
    });

    process.stdout.write(
      `Processing: ${buyer.buyerName} | ${buyer.quantity}x ${ticketType.name} @ ₱${ticketType.price} ... `
    );

    try {
      const res = await axios.post(`${API_URL}/payments/process/${reservation._id}`);
      const { order, tickets } = res.data.data;
      console.log(`OK`);
      console.log(`  Order: ${order.orderNumber} | ${tickets.length} ticket(s) generated | Email → ${buyer.buyerEmail}`);
      successCount++;
    } catch (err) {
      const msg = err.response?.data?.message ?? err.message;
      console.log(`FAILED`);
      console.log(`  Error: ${msg}`);
      // Clean up the reservation so it doesn't block availability
      await TicketReservation.findByIdAndDelete(reservation._id).catch(() => {});
      failCount++;
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────');
  console.log(`Done. ${successCount} succeeded, ${failCount} failed.`);
  console.log('\nUpdated availability:');

  const updated = await TicketType.find({ gameId: game._id });
  updated.forEach((tt) => {
    console.log(`  • ${tt.name} — sold: ${tt.sold}/${tt.quantity} | remaining: ${tt.quantity - tt.sold}`);
  });

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
