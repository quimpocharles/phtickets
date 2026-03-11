const SENDER = 'Global Hoops Ticketing System <puso-support@codeatcoffee.com>';

// ── Plain-text renderer ───────────────────────────────────────────────────────

/**
 * Generates a plain-text fallback for the EOD report.
 *
 * @param {import('../services/reportService').DailyTransactionReport} report
 * @returns {string}
 */
function eodReportText(report) {
  const { date, totalRevenue, totalTicketsSold, totalTransactions, byGame, byTicketType, scanStats } = report;

  const php     = (n) => `PHP ${Number(n).toLocaleString('en-PH')}`;
  const divider = (char = '-', len = 60) => char.repeat(len);
  const row     = (label, value, width = 44) =>
    `  ${label.padEnd(width - String(value).length)}${value}`;

  const sc = scanStats ?? { valid: 0, alreadyUsed: 0, invalid: 0, total: 0 };

  const gameLines = byGame.length === 0
    ? '  No sales recorded for this period.'
    : byGame.map((g) =>
        `  ${g.game}\n` +
        `  ${g.venue}\n` +
        row('  Passes Sold:', String(g.ticketsSold)) + '\n' +
        row('  Revenue:',     php(g.revenue))
      ).join('\n\n');

  const typeLines = byTicketType.length === 0
    ? '  No sales recorded for this period.'
    : byTicketType.map((t) =>
        `  ${t.ticketType} (${t.game})\n` +
        row('  Qty Sold:', String(t.quantitySold)) + '\n' +
        row('  Revenue:',  php(t.revenue))
      ).join('\n\n');

  return [
    divider('='),
    'GLOBAL HOOPS TICKETING SYSTEM — END OF DAY REPORT',
    divider('='),
    '',
    `Date: ${date}`,
    '',
    divider(),
    'SUMMARY',
    divider(),
    row('Total Revenue:',      php(totalRevenue)),
    row('Total Passes Sold:',  String(totalTicketsSold)),
    row('Total Transactions:', String(totalTransactions)),
    '',
    divider(),
    'SALES BY GAME',
    divider(),
    gameLines,
    '',
    divider(),
    'SALES BY PASS TYPE',
    divider(),
    typeLines,
    '',
    divider(),
    'SCANS',
    divider(),
    row('Valid:',        String(sc.valid)),
    row('Already Used:', String(sc.alreadyUsed)),
    row('Invalid:',      String(sc.invalid)),
    row('Total Scans:',  String(sc.total)),
    '',
    divider(),
    'Generated automatically at 11:59 PM Philippine Standard Time.',
    'puso-support@codeatcoffee.com',
    divider('='),
  ].join('\n');
}

// ── HTML renderer ─────────────────────────────────────────────────────────────

/**
 * Generates the HTML email body for the End-of-Day transaction report.
 *
 * @param {import('../services/reportService').DailyTransactionReport} report
 * @returns {{ subject: string, from: string, text: string, html: string }}
 */
function eodReportTemplate(report) {
  const { date, totalRevenue, totalTicketsSold, totalTransactions, byGame, byTicketType, scanStats } = report;
  const sc = scanStats ?? { valid: 0, alreadyUsed: 0, invalid: 0, total: 0 };

  const subject = `Global Hoops Ticketing System - End of Day Report | ${date}`;

  // ── Helpers ───────────────────────────────────────────────────────────────

  const php = (n) => `&#8369;${Number(n).toLocaleString('en-PH')}`;

  const cell = (content, align = 'left', extra = '') =>
    `<td style="padding:10px 14px;border-bottom:1px solid #eeeeee;text-align:${align};${extra}">${content}</td>`;

  const headerCell = (content, align = 'left') =>
    `<th style="padding:10px 14px;background:#f5f4f0;text-align:${align};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#888888;border-bottom:2px solid #e0e0e0;">${content}</th>`;

  // ── Sales by Game rows ────────────────────────────────────────────────────

  const gameRows = byGame.length === 0
    ? `<tr><td colspan="3" style="padding:16px;text-align:center;color:#aaaaaa;font-size:13px;">No sales recorded for this period.</td></tr>`
    : byGame.map((g, i) => `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#fafafa'};">
        ${cell(`
          <span style="font-weight:600;color:#1a1a1a;">${g.game}</span><br/>
          <span style="font-size:12px;color:#999999;">${g.venue}</span>
        `)}
        ${cell(g.ticketsSold.toLocaleString('en-PH'), 'center')}
        ${cell(`<strong>${php(g.revenue)}</strong>`, 'right')}
      </tr>`).join('');

  // ── Sales by Pass Type rows ───────────────────────────────────────────────

  const typeRows = byTicketType.length === 0
    ? `<tr><td colspan="4" style="padding:16px;text-align:center;color:#aaaaaa;font-size:13px;">No sales recorded for this period.</td></tr>`
    : byTicketType.map((t, i) => `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#fafafa'};">
        ${cell(`<span style="font-weight:600;color:#1a1a1a;">${t.ticketType}</span>`)}
        ${cell(`<span style="font-size:12px;color:#999999;">${t.game}</span>`)}
        ${cell(t.quantitySold.toLocaleString('en-PH'), 'center')}
        ${cell(`<strong>${php(t.revenue)}</strong>`, 'right')}
      </tr>`).join('');

  // ── HTML ──────────────────────────────────────────────────────────────────

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,Helvetica,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">

          <!-- ── Header ── -->
          <tr>
            <td style="background:#0133ae;padding:28px 32px;border-radius:10px 10px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.6);">
                      Global Hoops Ticketing System
                    </p>
                    <h1 style="margin:6px 0 0;font-size:22px;font-weight:900;color:#ffffff;line-height:1.2;">
                      End of Day Report
                    </h1>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.7);white-space:nowrap;">
                      ${date}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td style="background:#ffffff;padding:32px;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 10px 10px;">

              <!-- Date banner -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#fafafa;border:1px solid #eeeeee;border-left:4px solid #0133ae;padding:12px 16px;border-radius:0 6px 6px 0;">
                    <p style="margin:0;font-size:12px;color:#888888;text-transform:uppercase;letter-spacing:0.06em;">Report Date</p>
                    <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#1a1a1a;">${date}</p>
                  </td>
                </tr>
              </table>

              <!-- ── Summary ── -->
              <h2 style="margin:0 0 14px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#0133ae;">
                Summary
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <!-- Total Revenue -->
                  <td width="32%" style="background:#0133ae;padding:20px 16px;border-radius:8px;text-align:center;vertical-align:middle;">
                    <p style="margin:0;font-size:26px;font-weight:900;color:#ffffff;line-height:1;">
                      ${php(totalRevenue)}
                    </p>
                    <p style="margin:6px 0 0;font-size:11px;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.06em;">
                      Total Revenue
                    </p>
                  </td>
                  <td width="2%"></td>
                  <!-- Total Passes Sold -->
                  <td width="32%" style="background:#f5f4f0;padding:20px 16px;border-radius:8px;text-align:center;vertical-align:middle;">
                    <p style="margin:0;font-size:26px;font-weight:900;color:#1a1a1a;line-height:1;">
                      ${totalTicketsSold.toLocaleString('en-PH')}
                    </p>
                    <p style="margin:6px 0 0;font-size:11px;font-weight:600;color:#888888;text-transform:uppercase;letter-spacing:0.06em;">
                      Passes Sold
                    </p>
                  </td>
                  <td width="2%"></td>
                  <!-- Total Transactions -->
                  <td width="32%" style="background:#f5f4f0;padding:20px 16px;border-radius:8px;text-align:center;vertical-align:middle;">
                    <p style="margin:0;font-size:26px;font-weight:900;color:#1a1a1a;line-height:1;">
                      ${totalTransactions.toLocaleString('en-PH')}
                    </p>
                    <p style="margin:6px 0 0;font-size:11px;font-weight:600;color:#888888;text-transform:uppercase;letter-spacing:0.06em;">
                      Transactions
                    </p>
                  </td>
                </tr>
              </table>

              <!-- ── Sales by Game ── -->
              <h2 style="margin:0 0 14px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#0133ae;">
                Sales by Game
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eeeeee;border-radius:8px;overflow:hidden;margin-bottom:32px;font-size:13px;">
                <thead>
                  <tr>
                    ${headerCell('Game')}
                    ${headerCell('Passes Sold', 'center')}
                    ${headerCell('Revenue', 'right')}
                  </tr>
                </thead>
                <tbody>
                  ${gameRows}
                </tbody>
                ${byGame.length > 1 ? `
                <tfoot>
                  <tr style="background:#f5f4f0;">
                    <td style="padding:10px 14px;font-weight:700;font-size:12px;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.04em;">Total</td>
                    <td style="padding:10px 14px;text-align:center;font-weight:700;color:#1a1a1a;">${totalTicketsSold.toLocaleString('en-PH')}</td>
                    <td style="padding:10px 14px;text-align:right;font-weight:700;color:#0133ae;">${php(totalRevenue)}</td>
                  </tr>
                </tfoot>` : ''}
              </table>

              <!-- ── Sales by Pass Type ── -->
              <h2 style="margin:0 0 14px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#0133ae;">
                Sales by Pass Type
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eeeeee;border-radius:8px;overflow:hidden;margin-bottom:32px;font-size:13px;">
                <thead>
                  <tr>
                    ${headerCell('Pass Type')}
                    ${headerCell('Game')}
                    ${headerCell('Qty Sold', 'center')}
                    ${headerCell('Revenue', 'right')}
                  </tr>
                </thead>
                <tbody>
                  ${typeRows}
                </tbody>
                ${byTicketType.length > 1 ? `
                <tfoot>
                  <tr style="background:#f5f4f0;">
                    <td colspan="2" style="padding:10px 14px;font-weight:700;font-size:12px;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.04em;">Total</td>
                    <td style="padding:10px 14px;text-align:center;font-weight:700;color:#1a1a1a;">${totalTicketsSold.toLocaleString('en-PH')}</td>
                    <td style="padding:10px 14px;text-align:right;font-weight:700;color:#0133ae;">${php(totalRevenue)}</td>
                  </tr>
                </tfoot>` : ''}
              </table>

              <!-- ── Scans ── -->
              <h2 style="margin:0 0 14px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#0133ae;">
                Scans Today
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eeeeee;border-radius:8px;overflow:hidden;margin-bottom:32px;font-size:13px;">
                <thead>
                  <tr>
                    ${headerCell('Valid', 'center')}
                    ${headerCell('Already Used', 'center')}
                    ${headerCell('Invalid', 'center')}
                    ${headerCell('Total', 'center')}
                  </tr>
                </thead>
                <tbody>
                  <tr style="background:#ffffff;">
                    <td style="padding:14px;text-align:center;">
                      <span style="font-size:22px;font-weight:900;color:#16a34a;">${sc.valid.toLocaleString('en-PH')}</span>
                    </td>
                    <td style="padding:14px;text-align:center;">
                      <span style="font-size:22px;font-weight:900;color:#d97706;">${sc.alreadyUsed.toLocaleString('en-PH')}</span>
                    </td>
                    <td style="padding:14px;text-align:center;">
                      <span style="font-size:22px;font-weight:900;color:#dc2626;">${sc.invalid.toLocaleString('en-PH')}</span>
                    </td>
                    <td style="padding:14px;text-align:center;">
                      <span style="font-size:22px;font-weight:900;color:#1a1a1a;">${sc.total.toLocaleString('en-PH')}</span>
                    </td>
                  </tr>
                </tbody>
              </table>

              <!-- ── Footer ── -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-top:1px solid #eeeeee;padding-top:20px;text-align:center;">
                    <p style="margin:0;font-size:12px;color:#bbbbbb;">
                      This report was generated automatically at
                      <strong style="color:#888888;">11:59 PM Philippine Standard Time</strong>.
                    </p>
                    <p style="margin:6px 0 0;font-size:12px;color:#bbbbbb;">
                      Global Hoops Ticketing System &nbsp;·&nbsp; puso-support@codeatcoffee.com
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  return {
    from:    SENDER,
    subject,
    text:    eodReportText(report),
    html,
  };
}

module.exports = { eodReportTemplate };
