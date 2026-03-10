/**
 * Manually send the EOD report for a specific date.
 * Usage: node scripts/send-report-manual.js 2026-03-10
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Resend } = require('resend');

require('../src/models/Game');
require('../src/models/TicketType');
const Order           = require('../src/models/Order');
const ReportRecipient = require('../src/models/ReportRecipient');
const { eodReportTemplate } = require('../src/templates/eodReportTemplate');

// ── Date arg ──────────────────────────────────────────────────────────────────

const dateArg = process.argv[2]; // e.g. "2026-03-10"
if (!dateArg || !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
  console.error('Usage: node scripts/send-report-manual.js YYYY-MM-DD');
  process.exit(1);
}

const [year, month, day] = dateArg.split('-').map(Number);
const phOffsetMs = 8 * 60 * 60 * 1000;

// Midnight → 23:59:59.999 PHT expressed as UTC instants
const startUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - phOffsetMs);
const endUtc   = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - phOffsetMs);
const labelPh  = new Date(startUtc.getTime() + phOffsetMs)
  .toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

console.log(`Generating report for: ${labelPh}`);
console.log(`UTC window: ${startUtc.toISOString()} → ${endUtc.toISOString()}`);

// ── CSV ───────────────────────────────────────────────────────────────────────

function escapeCsv(value) {
  if (value == null) return '';
  const str = String(value);
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

function buildCsv(orders) {
  const headers = ['Order ID','Game','Ticket Type','Quantity','Total Amount','Buyer Email','Buyer Phone','Country','Payment Reference','Transaction Date'];
  const rows = orders.map((o) => [
    o.orderNumber,
    o.gameId?.description ?? 'Unknown',
    o.ticketTypeId?.name  ?? 'Unknown',
    o.quantity,
    o.totalAmount,
    o.buyerEmail,
    o.buyerPhone,
    o.country ?? '',
    o.paymentReference ?? '',
    o.createdAt ? new Date(o.createdAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : '',
  ].map(escapeCsv).join(','));
  return [headers.join(','), ...rows].join('\r\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const orders = await Order.find({
    paymentStatus: 'paid',
    createdAt: { $gte: startUtc, $lte: endUtc },
  })
    .populate('gameId', 'description venue gameDate')
    .populate('ticketTypeId', 'name price')
    .lean();

  console.log(`Found ${orders.length} paid order(s)`);

  // Build report object (same shape as reportService)
  const totalRevenue      = orders.reduce((s, o) => s + o.totalAmount, 0);
  const totalTicketsSold  = orders.reduce((s, o) => s + o.quantity, 0);

  const gameMap = new Map();
  const typeMap = new Map();
  for (const o of orders) {
    const gid = o.gameId?._id?.toString() ?? 'unknown';
    if (!gameMap.has(gid)) gameMap.set(gid, { gameId: gid, game: o.gameId?.description ?? '—', venue: o.gameId?.venue ?? '—', gameDate: o.gameId?.gameDate ?? null, ticketsSold: 0, revenue: 0 });
    gameMap.get(gid).ticketsSold += o.quantity;
    gameMap.get(gid).revenue     += o.totalAmount;

    const tid = o.ticketTypeId?._id?.toString() ?? 'unknown';
    if (!typeMap.has(tid)) typeMap.set(tid, { ticketTypeId: tid, ticketType: o.ticketTypeId?.name ?? '—', game: o.gameId?.description ?? '—', quantitySold: 0, revenue: 0 });
    typeMap.get(tid).quantitySold += o.quantity;
    typeMap.get(tid).revenue      += o.totalAmount;
  }

  const report = {
    date: labelPh,
    startUtc,
    endUtc,
    totalRevenue,
    totalTicketsSold,
    totalTransactions: orders.length,
    byGame:       [...gameMap.values()].sort((a, b) => b.revenue - a.revenue),
    byTicketType: [...typeMap.values()].sort((a, b) => b.revenue - a.revenue),
    orders,
  };

  // Recipients
  const activeRecipients = await ReportRecipient.find({ active: true }).select('email name');
  if (!activeRecipients.length) {
    console.error('No active recipients found. Add them via the admin UI first.');
    process.exit(1);
  }
  const to = activeRecipients.map((r) => r.name ? `${r.name} <${r.email}>` : r.email);
  console.log('Sending to:', to.join(', '));

  // Send
  const template    = eodReportTemplate(report);
  const csvFilename = `transactions-${dateArg}.csv`;
  const from        = process.env.EMAIL_FROM
    ? `Global Hoops Tickets <${process.env.EMAIL_FROM}>`
    : template.from;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: `[MANUAL] ${template.subject}`,
    html:    template.html,
    text:    template.text,
    attachments: [{ filename: csvFilename, content: Buffer.from(buildCsv(orders)).toString('base64') }],
  });

  if (error) throw new Error(error.message);

  console.log(`✓ Report sent for ${labelPh} — ${orders.length} orders, ₱${totalRevenue.toLocaleString()}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
