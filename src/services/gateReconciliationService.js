const mongoose = require('mongoose');
const Game = require('../models/Game');
const TicketType = require('../models/TicketType');
const Ticket = require('../models/Ticket');
const ScanLog = require('../models/ScanLog');
const Order = require('../models/Order');
/**
 * Generates a gate reconciliation report for a specific game.
 *
 * @param {string} gameId
 * @returns {Promise<GateReconciliationReport>}
 *
 * @typedef {Object} GateReconciliationReport
 * @property {string}   gameId
 * @property {string}   game             - "Team A vs Team B"
 * @property {string}   venue
 * @property {string}   gameDate
 * @property {number}   totalSold        - All tickets issued for the game
 * @property {number}   totalScanned     - Tickets with a VALID scan
 * @property {number}   noShows          - totalSold - totalScanned
 * @property {number}   invalidScans     - Scan attempts that matched no ticket
 * @property {number}   duplicateScans   - Scan attempts on already-used tickets
 * @property {TicketTypeBreakdown[]} byTicketType
 *
 * @typedef {Object} TicketTypeBreakdown
 * @property {string} ticketTypeId
 * @property {string} ticketType  - Ticket type name
 * @property {number} sold
 * @property {number} scanned
 * @property {number} noShows
 */
async function generateGateReconciliationReport(gameId) {
  const gid = new mongoose.Types.ObjectId(gameId);

  // ── Fetch game details ─────────────────────────────────────────────────────

  const game = await Game.findById(gid).lean();
  if (!game) {
    const err = new Error('Game not found.');
    err.statusCode = 404;
    throw err;
  }

  // ── Run queries in parallel ────────────────────────────────────────────────

  const [ticketTypes, ticketAgg, scanAgg, countryAgg] = await Promise.all([
    // All ticket types for the game (for names)
    TicketType.find({ gameId: gid }).lean(),

    // Per-ticket-type sold vs scanned counts
    Ticket.aggregate([
      { $match: { gameId: gid } },
      {
        $group: {
          _id:     '$ticketTypeId',
          sold:    { $sum: 1 },
          scanned: { $sum: { $cond: [{ $eq: ['$status', 'used'] }, 1, 0] } },
        },
      },
    ]),

    // Scan attempt counts by result for this game
    ScanLog.aggregate([
      { $match: { gameId: gid } },
      {
        $group: {
          _id:   '$scanResult',
          count: { $sum: 1 },
        },
      },
    ]),

    // Per-country tickets sold
    Order.aggregate([
      { $match: { gameId: gid, paymentStatus: 'paid' } },
      {
        $group: {
          _id:     '$country',
          tickets: { $sum: '$quantity' },
          revenue: { $sum: '$totalAmount' },
        },
      },
      { $sort: { tickets: -1 } },
    ]),
  ]);

  // ── Map ticket type names ──────────────────────────────────────────────────

  const typeNameMap = new Map(ticketTypes.map((t) => [t._id.toString(), t.name]));

  // ── Build per-ticket-type breakdown ───────────────────────────────────────

  const byTicketType = ticketAgg.map((row) => {
    const id       = row._id.toString();
    const sold     = row.sold;
    const scanned  = row.scanned;
    return {
      ticketTypeId: id,
      ticketType:   typeNameMap.get(id) ?? 'Unknown Type',
      sold,
      scanned,
      noShows:      sold - scanned,
    };
  }).sort((a, b) => b.sold - a.sold);

  // ── Totals from ticket aggregate ──────────────────────────────────────────

  const totalSold    = byTicketType.reduce((s, r) => s + r.sold,    0);
  const totalScanned = byTicketType.reduce((s, r) => s + r.scanned, 0);

  // ── Scan attempt counts ───────────────────────────────────────────────────

  const scanCountMap = new Map(scanAgg.map((r) => [r._id, r.count]));
  const invalidScans   = scanCountMap.get('INVALID')      ?? 0;
  const duplicateScans = scanCountMap.get('ALREADY_USED') ?? 0;

  const byCountry = countryAgg.map((r) => ({
    country: r._id || 'Unknown',
    tickets: r.tickets,
    revenue: r.revenue,
  }));

  return {
    gameId:       game._id.toString(),
    game:         game.description,
    venue:        game.venue,
    gameDate:     game.gameDate,
    totalSold,
    totalScanned,
    noShows:      totalSold - totalScanned,
    invalidScans,
    duplicateScans,
    byTicketType,
    byCountry,
  };
}

module.exports = { generateGateReconciliationReport };
