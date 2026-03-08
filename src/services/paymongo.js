const axios = require('axios');

const BASE_URL = 'https://api.paymongo.com/v1';

function getAuthHeader() {
  return `Basic ${Buffer.from(`${process.env.PAYMONGO_SECRET_KEY}:`).toString('base64')}`;
}

/**
 * Create a PayMongo Checkout Session.
 *
 * @param {{
 *   referenceNumber: string,   // cartId — echoed back in webhook + redirect URL
 *   totalAmount: number,       // PHP (not centavos); converted here
 *   description: string,
 *   buyerEmail: string,
 *   buyerPhone: string,
 *   buyerName?: string,
 * }} opts
 * @returns {Promise<{ checkoutId: string, redirectUrl: string }>}
 */
async function createCheckout({ referenceNumber, totalAmount, description, buyerEmail, buyerPhone, buyerName }) {
  const response = await axios.post(`${BASE_URL}/checkout_sessions`, {
    data: {
      attributes: {
        billing: {
          name:  buyerName  || undefined,
          email: buyerEmail,
          phone: buyerPhone,
        },
        line_items: [{
          currency: 'PHP',
          amount:   Math.round(totalAmount * 100), // PHP → centavos
          name:     description,
          quantity: 1,
        }],
        payment_method_types: ['card', 'gcash', 'paymaya', 'grab_pay', 'qrph', 'billease', 'shopee_pay'],
        success_url:      `${process.env.APP_BASE_URL}/payments/success?ref=${referenceNumber}`,
        cancel_url:       `${process.env.APP_BASE_URL}/payments/cancel?ref=${referenceNumber}`,
        reference_number:     referenceNumber,
        statement_descriptor: 'Global Hoops Intl',
        send_email_receipt:   false,
        show_description:     true,
        show_line_items:      true,
      },
    },
  }, {
    headers: {
      Authorization:  getAuthHeader(),
      'Content-Type': 'application/json',
    },
  });

  return {
    checkoutId:  response.data.data.id,
    redirectUrl: response.data.data.attributes.checkout_url,
  };
}

/**
 * Retrieve a checkout session and normalise its status.
 *
 * Returns { status: 'PAYMENT_SUCCESS' | 'PAYMENT_EXPIRED' | 'PAYMENT_PENDING', id }
 * so that callers don't need to know PayMongo-specific status strings.
 *
 * @param {string} checkoutId  — cs_* session ID stored on the reservation
 */
async function getPaymentStatus(checkoutId) {
  const response = await axios.get(`${BASE_URL}/checkout_sessions/${checkoutId}`, {
    headers: { Authorization: getAuthHeader() },
  });

  const attrs   = response.data.data.attributes;
  const payment = attrs.payments?.[0];

  if (payment?.attributes?.status === 'paid') {
    return { status: 'PAYMENT_SUCCESS', id: payment.id };
  }
  if (attrs.status === 'expired') {
    return { status: 'PAYMENT_EXPIRED', id: null };
  }
  return { status: 'PAYMENT_PENDING', id: null };
}

module.exports = { createCheckout, getPaymentStatus };
