const Order   = require('../models/Order');
const ScanLog = require('../models/ScanLog');

const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * Returns the UTC window and PH label for a given date.
 * @param {string} [dateStr] - 'YYYY-MM-DD' in PHT. Defaults to today PHT.
 * @returns {{ startUtc: Date, endUtc: Date, labelPh: string, dateStr: string }}
 */
function getDateRangePh(dateStr) {
  let year, month, day;

  if (dateStr) {
    [year, month, day] = dateStr.split('-').map(Number);
  } else {
    const phNow = new Date(Date.now() + PH_OFFSET_MS);
    year  = phNow.getUTCFullYear();
    month = phNow.getUTCMonth() + 1;
    day   = phNow.getUTCDate();
  }

  const startUtc = new Date(Date.UTC(year, month - 1, day,  0,  0,  0,   0) - PH_OFFSET_MS);
  const endUtc   = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - PH_OFFSET_MS);

  const labelPh = new Date(startUtc.getTime() + PH_OFFSET_MS)
    .toLocaleDateString('en-PH', {
      timeZone: 'Asia/Manila',
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

  const pad = (n) => String(n).padStart(2, '0');
  const resolvedDateStr = dateStr ?? `${year}-${pad(month)}-${pad(day)}`;

  return { startUtc, endUtc, labelPh, dateStr: resolvedDateStr };
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
/**
 * @param {string} [dateStr] - 'YYYY-MM-DD' PHT. Defaults to today PHT.
 */
async function generateDailyTransactionReport(dateStr) {
  const { startUtc, endUtc, labelPh, dateStr: resolvedDate } = getDateRangePh(dateStr);

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
    dateStr:            resolvedDate,
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
