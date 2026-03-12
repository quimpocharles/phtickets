const cron = require('node-cron');
const { Resend } = require('resend');
const { generateDailyTransactionReport } = require('../services/reportService');
const { eodReportTemplate } = require('../templates/eodReportTemplate');
const ReportRecipient = require('../models/ReportRecipient');
const ReportLog       = require('../models/ReportLog');

// ── Mailer ────────────────────────────────────────────────────────────────────

let _resend = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

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
    'Country',
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
      o.country ?? '',
      o.paymentReference ?? '',
      txDate,
    ].map(escapeCsv).join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns 'YYYY-MM-DD' for yesterday in PHT. */
function getYesterdayPhStr() {
  const phOffsetMs = 8 * 60 * 60 * 1000;
  const phYesterday = new Date(Date.now() + phOffsetMs - 24 * 60 * 60 * 1000);
  const y = phYesterday.getUTCFullYear();
  const m = String(phYesterday.getUTCMonth() + 1).padStart(2, '0');
  const d = String(phYesterday.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Build + send email from report data ───────────────────────────────────────

/**
 * Generate and send the EOD report for a given date.
 * @param {string} [dateStr] - 'YYYY-MM-DD' PHT. Defaults to today PHT.
 */
async function generateAndSendReport(dateStr) {
  const activeRecipients = await ReportRecipient.find({ active: true }).select('email name');

  if (activeRecipients.length === 0) {
    console.warn('[eod-report] No active recipients configured. Add recipients via POST /admin/report-recipients');
    return;
  }

  const recipients = activeRecipients.map((r) =>
    r.name ? `${r.name} <${r.email}>` : r.email
  );

  const report   = await generateDailyTransactionReport(dateStr);
  const template = eodReportTemplate(report);

  const csvContent  = buildTransactionsCsv(report.orders);
  const csvFilename = `transactions-${report.dateStr}.csv`;

  const from = process.env.EMAIL_FROM
    ? `Global Hoops Tickets <${process.env.EMAIL_FROM}>`
    : template.from;

  const { error } = await getResend().emails.send({
    from,
    to:      recipients,
    subject: template.subject,
    html:    template.html,
    text:    template.text,
    attachments: [
      {
        filename: csvFilename,
        content:  Buffer.from(csvContent).toString('base64'),
      },
    ],
  });

  if (error) throw new Error(error.message);

  // Log the successful send so the rescue cron can detect it
  await ReportLog.findOneAndUpdate(
    { reportDate: report.dateStr },
    {
      sentAt:         new Date(),
      recipientCount: activeRecipients.length,
      orderCount:     report.totalTransactions,
      revenue:        report.totalRevenue,
    },
    { upsert: true }
  );

  console.log(
    `[eod-report] Sent for ${report.dateStr} to ${recipients.join(', ')} — ` +
    `${report.totalTransactions} orders, ₱${report.totalRevenue.toLocaleString()} | CSV: ${csvFilename}`
  );
}

// ── Schedule ──────────────────────────────────────────────────────────────────

function scheduleEodReport() {
  // Primary: every night at 23:59 PHT
  cron.schedule('59 23 * * *', () => {
    console.log('[eod-report] Running end-of-day report…');
    generateAndSendReport().catch((err) =>
      console.error('[eod-report] Failed:', err.message)
    );
  }, { timezone: 'Asia/Manila' });

  // Rescue: every morning at 05:00 PHT — sends yesterday's report if missed
  cron.schedule('0 5 * * *', async () => {
    const yesterday = getYesterdayPhStr();
    const existing  = await ReportLog.findOne({ reportDate: yesterday });

    if (existing) {
      console.log(`[eod-report] Rescue check: report for ${yesterday} already sent at ${existing.sentAt.toISOString()}`);
      return;
    }

    console.log(`[eod-report] Rescue: no report found for ${yesterday} — sending now…`);
    generateAndSendReport(yesterday).catch((err) =>
      console.error('[eod-report] Rescue send failed:', err.message)
    );
  }, { timezone: 'Asia/Manila' });

  console.log('[eod-report] Scheduled: 23:59 PHT (primary) + 05:00 PHT (rescue)');
}

module.exports = { scheduleEodReport };
