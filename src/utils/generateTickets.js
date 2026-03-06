const QRCode = require('qrcode');
const Counter = require('../models/Counter');
const Ticket = require('../models/Ticket');
const { uploadQRCode } = require('../services/cloudinary');

const YEAR = '26'; // update each season

function formatTicketId(seq) {
  return `GH${YEAR}-${String(seq).padStart(6, '0')}`;
}

/**
 * Generate `quantity` Ticket documents for a paid order.
 *
 * Steps per ticket:
 *   1. Acquire sequential IDs from the counter (must be sequential — done serially)
 *   2. Generate QR code PNG buffers           (CPU-bound — done in parallel)
 *   3. Upload PNG buffers to Cloudinary        (I/O-bound — done in parallel)
 *   4. Bulk-insert all Ticket documents        (single insertMany)
 *
 * @param {{ orderId, gameId, ticketTypeId, quantity }} opts
 * @returns {Promise<import('../models/Ticket')[]>}
 */
async function generateTickets({ orderId, gameId, ticketTypeId, quantity }) {
  // Step 1 — acquire sequential IDs serially to guarantee uniqueness and order
  const ticketIds = [];
  for (let i = 0; i < quantity; i++) {
    const seq = await Counter.nextSeq('ticketId');
    ticketIds.push(formatTicketId(seq));
  }

  // Steps 2 + 3 — generate QR buffers and upload to Cloudinary in parallel
  // QR content is the plain ticket ID — guards scan via the /scanner page.
  const qrCodeUrls = await Promise.all(
    ticketIds.map(async (ticketId) => {
      const buffer = await QRCode.toBuffer(ticketId, {
        errorCorrectionLevel: 'H',
        width: 300,
      });
      return uploadQRCode(buffer, ticketId);
    })
  );

  // Step 4 — bulk insert all tickets in one round-trip
  const docs = ticketIds.map((ticketId, i) => ({
    ticketId,
    orderId,
    gameId,
    ticketTypeId,
    qrCodeUrl: qrCodeUrls[i],
    status: 'unused',
  }));

  const tickets = await Ticket.insertMany(docs);
  return tickets;
}

module.exports = { generateTickets };
