const axios = require('axios');

const SEMAPHORE_URL = 'https://api.semaphore.co/api/v4/messages';

/**
 * Send an SMS via Semaphore.
 * @param {string} to   - recipient phone number (e.g. 09171234567)
 * @param {string} body - message text (max 160 chars for 1 credit)
 */
async function sendSMS(to, body) {
  const params = new URLSearchParams({
    apikey: process.env.SEMAPHORE_API_KEY,
    number: to,
    message: body,
    sendername: process.env.SEMAPHORE_SENDER_NAME || 'NBTC',
  });

  const response = await axios.post(SEMAPHORE_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  return response.data;
}

/**
 * Notify buyer that their tickets are ready.
 */
async function sendTicketSMS({ phone, buyerName, orderNumber, game }) {
  const date = new Date(game.gameDate).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const msg =
    `Hi ${buyerName || 'there'}! Your NBTC tickets (Order ${orderNumber}) ` +
    `for ${game.description} on ${date} are confirmed. ` +
    `Check your email for QR codes.`;

  return sendSMS(phone, msg);
}

module.exports = { sendSMS, sendTicketSMS };
