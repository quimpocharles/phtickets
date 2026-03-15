const fs           = require('fs');
const path         = require('path');
const { Resend }   = require('resend');
const nodemailer   = require('nodemailer');
const { cloudinary } = require('./cloudinary');
const ReportRecipient = require('../models/ReportRecipient');

let _resend = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

let _smtpTransport = null;
function getSmtp() {
  if (!_smtpTransport) {
    _smtpTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return _smtpTransport;
}

async function sendViaResendWithFallback({ from, to, subject, html }) {
  try {
    const { error } = await getResend().emails.send({ from, to, subject, html });
    if (error) throw new Error(error.message);
    return 'resend';
  } catch (resendErr) {
    console.warn('[mailer] Resend failed, falling back to SMTP:', resendErr.message);
    await getSmtp().sendMail({ from, to, subject, html });
    return 'smtp';
  }
}

// Upload event banner to Cloudinary once; cached in-process
let _bannerUrl = null;
async function getBannerUrl() {
  if (_bannerUrl) return _bannerUrl;
  const bannerPath = path.join(__dirname, '../../web/public/smart-gh.jpg');
  if (!fs.existsSync(bannerPath)) return '';
  try {
    const result = await cloudinary.uploader.upload(bannerPath, {
      folder:        'ticket-sys/banners',
      public_id:     'smart-gh-2026-email',
      overwrite:     false,
      resource_type: 'image',
    });
    _bannerUrl = result.secure_url;
  } catch (err) {
    console.error('[mailer] Banner upload failed:', err.message);
    _bannerUrl = '';
  }
  return _bannerUrl;
}

/**
 * Send ticket confirmation email with QR codes.
 *
 * allTickets is a flat array where each item has:
 *   { ticketId, ticketTypeName, ticketTypeScope, orderNumber, qrCodeUrl, ... }
 *
 * @param {{ to, buyerName, game, grandTotal, allTickets }} opts
 */
async function sendTicketEmail({ to, buyerName, game, grandTotal, allTickets }) {
  const gameDate = new Date(game.gameDate);
  const dateStr  = gameDate.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
  const timeStr  = gameDate.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' });

  const bannerUrl = await getBannerUrl();

  // Build one ticket card per ticket; QR served from Cloudinary URL
  const ticketCards = allTickets.map((t, idx) => {
    const qrUrl      = t.qrCodeUrl || '';
    const scopeLabel = t.ticketTypeScope === 'all' ? 'All Events Pass' : 'Single Day Pass';
    return `
    <!-- Ticket ${idx + 1} -->
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto 40px;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.18);">
      <tr>

        <!-- Left: event image -->
        <td width="356" style="width:356px;min-width:356px;background:#111827;vertical-align:top;padding:0;">
          ${bannerUrl
            ? `<img src="${bannerUrl}" width="356" height="475" style="display:block;width:356px;height:475px;" alt="Smart Global Hoops 2026" />`
            : `<div style="width:356px;height:475px;background:#111827;display:table-cell;vertical-align:middle;text-align:center;">
                 <p style="margin:0;color:#fed000;font-size:13px;font-weight:900;letter-spacing:0.05em;line-height:1.4;">SMART<br>GLOBAL<br>HOOPS<br>2026</p>
               </div>`
          }
        </td>

        <!-- Right: ticket content -->
        <td style="vertical-align:top;padding:0;">
          <table width="100%" cellpadding="0" cellspacing="0">

            <!-- Ticket type band -->
            <tr>
              <td style="background:#111827;padding:12px 16px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <p style="margin:0;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:0.06em;color:#fed000;line-height:1.2;">${t.ticketTypeName || ''}</p>
                      <p style="margin:3px 0 0;font-size:10px;color:rgba(255,255,255,0.4);">${scopeLabel}</p>
                    </td>
                    <td style="vertical-align:middle;text-align:right;white-space:nowrap;padding-left:8px;">
                      <p style="margin:0;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.3);">Pass</p>
                      <p style="margin:2px 0 0;font-size:12px;font-weight:700;color:#ffffff;">${idx + 1} / ${allTickets.length}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Details -->
            <tr>
              <td style="background:#ffffff;padding:14px 16px 10px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom:10px;vertical-align:top;width:50%;">
                      <p style="margin:0 0 2px;font-size:8px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;">Date &amp; Time</p>
                      <p style="margin:0;font-size:12px;font-weight:600;color:#111827;">${dateStr}</p>
                      <p style="margin:1px 0 0;font-size:10px;color:#6b7280;">${timeStr}</p>
                    </td>
                    <td style="padding-bottom:10px;vertical-align:top;text-align:right;">
                      <p style="margin:0 0 2px;font-size:8px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;">Total Paid</p>
                      <p style="margin:0;font-size:18px;font-weight:900;color:#111827;">&#8369;${(grandTotal || 0).toLocaleString()}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom:10px;vertical-align:top;">
                      <p style="margin:0 0 2px;font-size:8px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;">Pass No.</p>
                      <p style="margin:0;font-size:10px;font-weight:700;color:#111827;font-family:monospace;letter-spacing:0.04em;">${t.ticketId || ''}</p>
                    </td>
                    <td style="padding-bottom:10px;vertical-align:top;text-align:right;">
                      <p style="margin:0 0 2px;font-size:8px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;">Venue</p>
                      <p style="margin:0;font-size:10px;color:#374151;">${game.venue}</p>
                    </td>
                  </tr>
                  ${buyerName ? `
                  <tr>
                    <td colspan="2">
                      <p style="margin:0 0 2px;font-size:8px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;">Pass Holder</p>
                      <p style="margin:0;font-size:12px;font-weight:600;color:#111827;">${buyerName}</p>
                    </td>
                  </tr>` : ''}
                </table>
              </td>
            </tr>

            <!-- Perforated separator -->
            <tr>
              <td style="background:#ffffff;padding:6px 16px;">
                <div style="border-top:2px dashed #e5e7eb;"></div>
              </td>
            </tr>

            <!-- QR section -->
            <tr>
              <td style="background:#ffffff;padding:12px 16px 16px;text-align:center;">
                <div style="display:inline-block;padding:8px;border:2px solid #f3f4f6;border-radius:12px;background:#ffffff;">
                  ${qrUrl
                    ? `<img src="${qrUrl}" alt="QR code – ${t.ticketId}" width="160" height="160" style="display:block;" />`
                    : `<div style="width:160px;height:160px;background:#f3f4f6;"></div>`
                  }
                </div>
                <p style="margin:8px 0 2px;font-family:monospace;font-size:10px;color:#9ca3af;letter-spacing:0.08em;">${t.ticketId}</p>
                <p style="margin:0;font-size:10px;font-weight:600;color:#6b7280;">Present at venue entrance</p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:8px 16px;text-align:center;">
                <p style="margin:0;font-size:9px;color:#9ca3af;">Non-transferable &middot; Do not share QR code</p>
              </td>
            </tr>

          </table>
        </td>

      </tr>
    </table>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:32px 16px;">
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto 28px;">
          <tr>
            <td>
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;">Payment Confirmed</p>
              <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;">Your Passes Are Ready</p>
            </td>
          </tr>
        </table>

        ${ticketCards}

        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;">
          <tr>
            <td style="text-align:center;padding-bottom:32px;">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);">Passes sent to ${to}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const from = `Global Hoops Passes <${process.env.EMAIL_FROM || 'tickets@globalhoops.shop'}>`;

  console.log('[mailer] Sending pass email to:', to, '| from:', from);

  const provider = await sendViaResendWithFallback({
    from,
    to,
    subject: `Your Global Hoops Passes – Order ${allTickets[0]?.orderNumber ?? ''}`,
    html,
  });

  console.log('[mailer] Email sent successfully to:', to, '| via:', provider);
}

/**
 * Send a real-time transaction notification email to all active EOD report recipients.
 * Called non-blocking after a successful payment is processed.
 *
 * @param {{ game, buyerName, buyerEmail, grandTotal, allTickets }} opts
 */
async function sendTransactionNotification({ game, buyerName, buyerEmail, grandTotal, allTickets }) {
  const activeRecipients = await ReportRecipient.find({ active: true }).select('email name');
  if (!activeRecipients.length) return;

  const recipients = activeRecipients.map((r) =>
    r.name ? `${r.name} <${r.email}>` : r.email
  );

  const gameDate = new Date(game.gameDate);
  const dateStr  = gameDate.toLocaleDateString('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
  });
  const now = new Date().toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  // Group passes by type name
  const typeMap = new Map();
  for (const t of allTickets) {
    typeMap.set(t.ticketTypeName, (typeMap.get(t.ticketTypeName) ?? 0) + 1);
  }

  const passRows = [...typeMap.entries()].map(([name, count]) => `
    <tr>
      <td style="padding:8px 16px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;">${name}</td>
      <td style="padding:8px 16px;font-size:13px;font-weight:700;color:#111827;text-align:right;border-bottom:1px solid #f3f4f6;">${count}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">

          <!-- Header -->
          <tr>
            <td style="background:#0133ae;padding:20px 28px;">
              <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.6);">New Transaction</p>
              <p style="margin:4px 0 0;font-size:20px;font-weight:900;color:#ffffff;">&#8369;${(grandTotal).toLocaleString('en-PH')} &mdash; Payment Confirmed</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px 28px;">

              <p style="margin:0 0 2px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">Game</p>
              <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#111827;">${game.description}</p>

              <p style="margin:0 0 2px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">Date &amp; Venue</p>
              <p style="margin:0 0 16px;font-size:13px;color:#374151;">${dateStr} &middot; ${game.venue}</p>

              <p style="margin:0 0 2px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">Buyer</p>
              <p style="margin:0 0 16px;font-size:13px;color:#374151;">${buyerName || '&mdash;'} &lt;${buyerEmail}&gt;</p>

              <p style="margin:0 0 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">Passes</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:16px;">
                <tbody>${passRows}</tbody>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#374151;">Total Paid</td>
                  <td style="padding:12px 16px;font-size:16px;font-weight:900;color:#111827;text-align:right;">&#8369;${(grandTotal).toLocaleString('en-PH')}</td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:14px 28px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">Confirmed at ${now} &middot; Global Hoops Pass System</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const from = `Global Hoops Passes <${process.env.EMAIL_FROM || 'tickets@globalhoops.shop'}>`;

  const provider = await sendViaResendWithFallback({
    from,
    to: recipients,
    subject: `New Sale: ₱${(grandTotal).toLocaleString('en-PH')} — ${game.description}`,
    html,
  });

  console.log('[mailer] Transaction notification sent to:', recipients.join(', '), '| via:', provider);
}

module.exports = { sendTicketEmail, sendTransactionNotification };
