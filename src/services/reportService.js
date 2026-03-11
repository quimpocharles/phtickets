const Order   = require('../models/Order');
const ScanLog = require('../models/ScanLog');

/**
 * Returns the start and end of today in UTC, calculated using Asia/Manila (UTC+8).
 *
 * @returns {{ startUtc: Date, endUtc: Date, labelPh: string }}
 */
function getTodayRangePh() {
  const phOffsetMs = 8 * 60 * 60 * 1000;
  const phNow      = new Date(Date.now() + phOffsetMs);

  // Midnight and end-of-day in PH time, expressed as UTC instants
  const startUtc = new Date(
    Date.UTC(phNow.getUTCFullYear(), phNow.getUTCMonth(), phNow.getUTCDate(), 0, 0, 0, 0)
    - phOffsetMs
  );
  const endUtc = new Date(
    Date.UTC(phNow.getUTCFullYear(), phNow.getUTCMonth(), phNow.getUTCDate(), 23, 59, 59, 999)
    - phOffsetMs
  );

  const labelPh = phNow.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return { startUtc, endUtc, labelPh };
}

/**
 * Generates a daily transaction report for today (Asia/Manila timezone).
 *
 * Queries all paid orders whose createdAt falls within today's date range,
 * then builds a structured summary with totals and per-game / per-ticket-type
 * breakdowns.
 *
 * @returns {Promise<DailyTransactionReport>}
 *
 * @typedef {Object} DailyTransactionReport
 * @property {string}   date              - Human-readable PH date label
 * @property {Date}     startUtc          - Query window start (UTC)
 * @property {Date}     endUtc            - Query window end (UTC)
 * @property {number}   totalRevenue      - Sum of all order amounts
 * @property {number}   totalTicketsSold  - Sum of all order quantities
 * @property {number}   totalTransactions - Number of paid orders
 * @property {GameBreakdown[]}       byGame       - Per-game summary
 * @property {TicketTypeBreakdown[]} byTicketType - Per-ticket-type summary
 * @property {Object[]}              orders       - Raw populated order documents
 *
 * @typedef {Object} GameBreakdown
 * @property {string} gameId
 * @property {string} game        - "Team A vs Team B"
 * @property {string} venue
 * @property {string} gameDate
 * @property {number} ticketsSold
 * @property {number} revenue
 *
 * @typedef {Object} TicketTypeBreakdown
 * @property {string} ticketTypeId
 * @property {string} ticketType   - Ticket type name
 * @property {string} game         - Parent game label
 * @property {number} quantitySold
 * @property {number} revenue
 */
async function generateDailyTransactionReport() {
  const { startUtc, endUtc, labelPh } = getTodayRangePh();

  const orders = await Order.find({
    paymentStatus: 'paid',
    createdAt: { $gte: startUtc, $lte: endUtc },
  })
    .populate('gameId', 'description venue gameDate')
    .populate('ticketTypeId', 'name price')
    .lean();

  // ── Totals ────────────────────────────────────────────────────────────────

  const totalRevenue     = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalTicketsSold = orders.reduce((sum, o) => sum + o.quantity,    0);
  const totalTransactions = orders.length;

  // ── Per-game breakdown ────────────────────────────────────────────────────

  const gameMap = new Map();

  for (const order of orders) {
    const id    = order.gameId?._id?.toString() ?? 'unknown';
    const label = order.gameId?.description ?? 'Unknown Game';

    if (!gameMap.has(id)) {
      gameMap.set(id, {
        gameId:      id,
        game:        label,
        venue:       order.gameId?.venue    ?? '—',
        gameDate:    order.gameId?.gameDate ?? null,
        ticketsSold: 0,
        revenue:     0,
      });
    }

    const entry = gameMap.get(id);
    entry.ticketsSold += order.quantity;
    entry.revenue     += order.totalAmount;
  }

  const byGame = [...gameMap.values()].sort((a, b) => b.revenue - a.revenue);

  // ── Per-ticket-type breakdown ─────────────────────────────────────────────

  const typeMap = new Map();

  for (const order of orders) {
    const id    = order.ticketTypeId?._id?.toString() ?? 'unknown';
    const name  = order.ticketTypeId?.name ?? 'Unknown Type';
    const game  = order.gameId?.description ?? 'Unknown Game';

    if (!typeMap.has(id)) {
      typeMap.set(id, {
        ticketTypeId: id,
        ticketType:   name,
        game,
        quantitySold: 0,
        revenue:      0,
      });
    }

    const entry = typeMap.get(id);
    entry.quantitySold += order.quantity;
    entry.revenue      += order.totalAmount;
  }

  const byTicketType = [...typeMap.values()].sort((a, b) => b.revenue - a.revenue);

  // ── Scan stats ────────────────────────────────────────────────────────────

  const scanCounts = await ScanLog.aggregate([
    { $match: { scanTime: { $gte: startUtc, $lte: endUtc } } },
    { $group: { _id: '$scanResult', count: { $sum: 1 } } },
  ]);

  const scanStats = { valid: 0, alreadyUsed: 0, invalid: 0, total: 0 };
  for (const r of scanCounts) {
    if (r._id === 'VALID')        scanStats.valid       = r.count;
    else if (r._id === 'ALREADY_USED') scanStats.alreadyUsed = r.count;
    else if (r._id === 'INVALID') scanStats.invalid     = r.count;
  }
  scanStats.total = scanStats.valid + scanStats.alreadyUsed + scanStats.invalid;

  return {
    date:               labelPh,
    startUtc,
    endUtc,
    totalRevenue,
    totalTicketsSold,
    totalTransactions,
    byGame,
    byTicketType,
    orders,
    scanStats,
  };
}

module.exports = { generateDailyTransactionReport };
