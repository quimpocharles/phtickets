const nodemailer = require('nodemailer');
const QRCode     = require('qrcode');

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
 * @param {{ to, buyerName, orderNumber, totalAmount, ticketTypeName, game, tickets }} opts
 */
async function sendTicketEmail({ to, buyerName, orderNumber, totalAmount, ticketTypeName, game, tickets }) {
  const gameDate = new Date(game.gameDate);
  const dateStr  = gameDate.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr  = gameDate.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });

  // Build one ticket card per ticket, QR embedded as base64
  const ticketCards = (
    await Promise.all(
      tickets.map(async (t, idx) => {
        const dataUri = await QRCode.toDataURL(t.ticketId, {
          errorCorrectionLevel: 'H',
          width: 220,
          margin: 2,
        });
        return `
        <!-- Ticket ${idx + 1} -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto 32px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
          <!-- Details section -->
          <tr>
            <td style="padding:32px 28px 24px;">
              <!-- Logo placeholder -->
              <p style="margin:0 0 20px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;">NBTC 2026</p>

              <!-- Event name -->
              <p style="margin:0 0 20px;font-size:20px;font-weight:800;color:#111827;line-height:1.3;">${game.description}</p>

              <!-- Grid of details -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:14px;vertical-align:top;width:50%;">
                    <p style="margin:0 0 3px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;">Date &amp; Time</p>
                    <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${dateStr}</p>
                    <p style="margin:2px 0 0;font-size:13px;color:#6b7280;">${timeStr}</p>
                  </td>
                  <td style="padding-bottom:14px;vertical-align:top;text-align:right;">
                    <p style="margin:0 0 3px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;">Total Paid</p>
                    <p style="margin:0;font-size:18px;font-weight:800;color:#111827;">&#8369;${(totalAmount || 0).toLocaleString()}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:14px;vertical-align:top;">
                    <p style="margin:0 0 3px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;">Order Number</p>
                    <p style="margin:0;font-size:13px;font-weight:700;color:#111827;font-family:monospace;">${orderNumber}</p>
                  </td>
                  <td style="padding-bottom:14px;vertical-align:top;text-align:right;">
                    <p style="margin:0 0 3px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;">Ticket</p>
                    <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${idx + 1} / ${tickets.length}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:14px;vertical-align:top;" colspan="2">
                    <p style="margin:0 0 3px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;">Ticket Type</p>
                    <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${ticketTypeName || ''}</p>
                  </td>
                </tr>
                <tr>
                  <td style="vertical-align:top;" colspan="2">
                    <p style="margin:0 0 3px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;">Venue</p>
                    <p style="margin:0;font-size:14px;color:#374151;">${game.venue}</p>
                  </td>
                </tr>
                ${buyerName ? `
                <tr>
                  <td style="padding-top:14px;vertical-align:top;" colspan="2">
                    <p style="margin:0 0 3px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;">Holder</p>
                    <p style="margin:0;font-size:14px;color:#374151;">${buyerName}</p>
                  </td>
                </tr>` : ''}
              </table>
            </td>
          </tr>

          <!-- Dashed separator -->
          <tr>
            <td style="padding:0 12px;">
              <div style="border-top:2px dashed #e5e7eb;"></div>
            </td>
          </tr>

          <!-- QR section -->
          <tr>
            <td style="padding:28px;text-align:center;">
              <img src="${dataUri}" alt="QR code" width="200" height="200" style="display:block;margin:0 auto;" />
              <p style="margin:10px 0 2px;font-family:monospace;font-size:12px;color:#9ca3af;letter-spacing:0.08em;">${t.ticketId}</p>
              <p style="margin:0;font-size:11px;color:#d1d5db;">Scan at entrance</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:12px 28px;background:#f9fafb;border-top:1px solid #f3f4f6;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">Non-transferable &middot; Present QR code at venue entrance &middot; Valid for one entry</p>
            </td>
          </tr>
        </table>`;
      })
    )
  ).join('');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td>
        <!-- Header -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto 24px;">
          <tr>
            <td>
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Payment Confirmed</p>
              <p style="margin:0;font-size:22px;font-weight:800;color:#111827;">Your Tickets Are Ready</p>
            </td>
          </tr>
        </table>

        ${ticketCards}

        <!-- Footer note -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;">
          <tr>
            <td style="text-align:center;padding-bottom:32px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">Tickets sent to ${to}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const from = process.env.EMAIL_FROM
    ? `NBTC Tickets <${process.env.EMAIL_FROM}>`
    : `NBTC Tickets <${process.env.SMTP_USER}>`;

  console.log('[mailer] Sending ticket email to:', to, '| from:', from);

  await transporter.sendMail({
    from,
    to,
    subject: `Your NBTC Tickets – Order ${orderNumber}`,
    html,
  });

  console.log('[mailer] Email sent successfully to:', to);
}

module.exports = { sendTicketEmail };
