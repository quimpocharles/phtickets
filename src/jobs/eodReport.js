const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { generateDailyTransactionReport } = require('../services/reportService');
const { eodReportTemplate } = require('../templates/eodReportTemplate');
const ReportRecipient = require('../models/ReportRecipient');

// ── Mailer ────────────────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── CSV builder ───────────────────────────────────────────────────────────────

function escapeCsv(value) {
  if (value == null) return '';
  const str = String(value);
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

function buildTransactionsCsv(orders) {
  const headers = [
    'Order ID',
    'Game',
    'Ticket Type',
    'Quantity',
    'Total Amount',
    'Buyer Email',
    'Buyer Phone',
    'Payment Reference',
    'Transaction Date',
  ];

  const rows = orders.map((o) => {
    const game = o.gameId?.description ?? 'Unknown Game';
    const ticketType  = o.ticketTypeId?.name ?? 'Unknown Type';
    const txDate      = o.createdAt
      ? new Date(o.createdAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
      : '';

    return [
      o.orderNumber,
      game,
      ticketType,
      o.quantity,
      o.totalAmount,
      o.buyerEmail,
      o.buyerPhone,
      o.paymentReference ?? '',
      txDate,
    ].map(escapeCsv).join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

// ── Build + send email from report data ───────────────────────────────────────

async function generateAndSendReport() {
  const activeRecipients = await ReportRecipient.find({ active: true }).select('email name');

  if (activeRecipients.length === 0) {
    console.warn('[eod-report] No active recipients configured. Add recipients via POST /admin/report-recipients');
    return;
  }

  const recipients = activeRecipients.map((r) =>
    r.name ? `${r.name} <${r.email}>` : r.email
  );

  const report   = await generateDailyTransactionReport();
  const template = eodReportTemplate(report); // { from, subject, text, html }

  const csvContent  = buildTransactionsCsv(report.orders);
  const csvFilename = `transactions-${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })}.csv`;

  await transporter.sendMail({
    ...template,
    to: recipients.join(', '),
    attachments: [
      {
        filename:    csvFilename,
        content:     csvContent,
        contentType: 'text/csv; charset=utf-8',
      },
    ],
  });

  console.log(
    `[eod-report] Sent from ${template.from} to ${recipients.join(', ')} — ` +
    `${report.totalTransactions} orders, ₱${report.totalRevenue.toLocaleString()} | CSV: ${csvFilename}`
  );
}

// ── Schedule ──────────────────────────────────────────────────────────────────

function scheduleEodReport() {
  cron.schedule('59 23 * * *', () => {
    console.log('[eod-report] Running end-of-day report…');
    generateAndSendReport().catch((err) =>
      console.error('[eod-report] Failed:', err.message)
    );
  }, {
    timezone: 'Asia/Manila',
  });

  console.log('[eod-report] Scheduled for 23:59 Asia/Manila');
}

module.exports = { scheduleEodReport };
