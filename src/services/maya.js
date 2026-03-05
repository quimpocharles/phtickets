const axios = require('axios');

const BASE_URL = process.env.MAYA_BASE_URL || 'https://pg.maya.ph';

function getAuthHeader(key = process.env.MAYA_SECRET_KEY) {
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

/**
 * Create a Maya checkout session.
 *
 * @param {{
 *   referenceNumber: string,   // correlates Maya's webhook back to our record
 *   totalAmount: number,
 *   description: string,
 *   buyerEmail: string,
 *   buyerPhone: string,
 *   buyerName?: string,
 * }} opts
 * @returns {Promise<{ checkoutId: string, redirectUrl: string }>}
 */
async function createCheckout({ referenceNumber, totalAmount, description, buyerEmail, buyerPhone, buyerName }) {
  const payload = {
    totalAmount: {
      value: totalAmount,
      currency: 'PHP',
      details: { subtotal: totalAmount },
    },
    buyer: {
      firstName: buyerName ? buyerName.split(' ')[0] : undefined,
      lastName: buyerName ? buyerName.split(' ').slice(1).join(' ') || undefined : undefined,
      contact: {
        email: buyerEmail,
        phone: buyerPhone,
      },
    },
    items: [
      {
        name: description,
        quantity: 1,
        code: referenceNumber,
        description,
        amount: { value: totalAmount },
        totalAmount: { value: totalAmount },
      },
    ],
    redirectUrl: {
      success: `${process.env.APP_BASE_URL}/payments/success?ref=${referenceNumber}`,
      failure: `${process.env.APP_BASE_URL}/payments/failure?ref=${referenceNumber}`,
      cancel:  `${process.env.APP_BASE_URL}/payments/cancel?ref=${referenceNumber}`,
    },
    // Maya echoes this value back verbatim in the webhook payload as
    // `requestReferenceNumber`.  We use the reservationId so the webhook
    // handler can look up the reservation without needing an Order to exist.
    requestReferenceNumber: referenceNumber,
    metadata: {},
  };

  const response = await axios.post(`${BASE_URL}/checkout/v1/checkouts`, payload, {
    headers: {
      Authorization: getAuthHeader(process.env.MAYA_PUBLIC_KEY),
      'Content-Type': 'application/json',
    },
  });

  return {
    checkoutId: response.data.checkoutId,
    redirectUrl: response.data.redirectUrl,
  };
}

/**
 * Retrieve payment status from Maya.
 * @param {string} checkoutId
 */
async function getPaymentStatus(checkoutId) {
  const response = await axios.get(
    `${BASE_URL}/checkout/v1/checkouts/${checkoutId}`,
    {
      headers: { Authorization: getAuthHeader(process.env.MAYA_SECRET_KEY) },
    }
  );
  return response.data;
}

module.exports = { createCheckout, getPaymentStatus };
