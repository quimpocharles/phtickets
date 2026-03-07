const fs         = require('fs');
const path       = require('path');
const nodemailer = require('nodemailer');
const QRCode     = require('qrcode');

// Load event banner once at startup; gracefully falls back to empty string
const bannerDataUri = (() => {
  try {
    const buf = fs.readFileSync(path.join(__dirname, '../../web/public/smart-gh.jpg'));
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
})();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send ticket confirmation email with QR codes.
 *
 * allTickets is a flat array where each item has:
 *   { ticketId, ticketTypeName, orderNumber, ... }
 *
 * @param {{ to, buyerName, game, grandTotal, allTickets }} opts
 */
async function sendTicketEmail({ to, buyerName, game, grandTotal, allTickets }) {
  const gameDate = new Date(game.gameDate);
  const dateStr  = gameDate.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
  const timeStr  = gameDate.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' });

  // Build one ticket card per ticket, QR embedded as base64
  const ticketCards = (
    await Promise.all(
      allTickets.map(async (t, idx) => {
        const qrDataUri = await QRCode.toDataURL(t.ticketId, {
          errorCorrectionLevel: 'H',
          width: 280,
          margin: 2,
        });
        const scopeLabel = t.ticketTypeScope === 'all' ? 'All Events Pass' : 'Single Day Pass';
        return `
        <!-- Ticket ${idx + 1} -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto 40px;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.18);">
          <tr>

            <!-- Left: event image — sized to fill the full card height (3:4 ratio) -->
            <td width="356" style="width:356px;min-width:356px;background:#111827;vertical-align:top;padding:0;">
              ${bannerDataUri
                ? `<img src="${bannerDataUri}" width="356" height="475" style="display:block;width:356px;height:475px;" alt="Smart Global Hoops 2026" />`
                : `<div style="width:356px;height:475px;background:#111827;display:table-cell;vertical-align:middle;text-align:center;">
                     <p style="margin:0;color:#fed000;font-size:13px;font-weight:900;letter-spacing:0.05em;line-height:1.4;">SMART<br>GLOBAL<br>HOOPS<br>2026</p>
                   </div>`
              }
            </td>

            <!-- Right: all ticket content as nested table -->
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
                          <p style="margin:0;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.3);">Ticket</p>
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
                          <p style="margin:0 0 2px;font-size:8px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;">Ticket No.</p>
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
                          <p style="margin:0 0 2px;font-size:8px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;">Ticket Holder</p>
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
                      <img src="${qrDataUri}" alt="QR code – ${t.ticketId}" width="160" height="160" style="display:block;" />
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
      })
    )
  ).join('');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:32px 16px;">
    <tr>
      <td>
        <!-- Header -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto 28px;">
          <tr>
            <td>
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;">Payment Confirmed</p>
              <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;">Your Tickets Are Ready</p>
            </td>
          </tr>
        </table>

        ${ticketCards}

        <!-- Footer note -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;">
          <tr>
            <td style="text-align:center;padding-bottom:32px;">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);">Tickets sent to ${to}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const from = process.env.EMAIL_FROM
    ? `Global Hoops Tickets <${process.env.EMAIL_FROM}>`
    : `Global Hoops Tickets <${process.env.SMTP_USER}>`;

  console.log('[mailer] Sending ticket email to:', to, '| from:', from);

  await transporter.sendMail({
    from,
    to,
    subject: `Your Global Hoops Tickets – Order ${allTickets[0]?.orderNumber ?? ''}`,
    html,
  });

  console.log('[mailer] Email sent successfully to:', to);
}

module.exports = { sendTicketEmail };
