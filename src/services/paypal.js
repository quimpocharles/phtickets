const axios = require('axios');

const SANDBOX  = process.env.PAYPAL_MODE !== 'live';
const BASE_URL = SANDBOX
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

// ── OAuth token cache ─────────────────────────────────────────────────────────
let _token = null;
let _tokenExpiresAt = 0;

async function getAccessToken() {
  if (_token && Date.now() < _tokenExpiresAt - 30_000) return _token;

  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const res = await axios.post(
    `${BASE_URL}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      headers: {
        Authorization:  `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  _token = res.data.access_token;
  _tokenExpiresAt = Date.now() + res.data.expires_in * 1000;
  return _token;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a PayPal order.
 * Stores cartId in custom_id so it is echoed back in webhook event payloads.
 *
 * @param {{
 *   referenceNumber: string,   // cartId
 *   totalAmountPhp:  number,   // PHP (NOT centavos)
 *   description:     string,
 *   buyerEmail:      string,
 *   buyerName?:      string,
 * }} opts
 * @returns {Promise<{ paypalOrderId: string, approvalUrl: string }>}
 */
async function createOrder({ referenceNumber, totalAmountPhp, description, buyerEmail, buyerName }) {
  const token = await getAccessToken();

  const res = await axios.post(`${BASE_URL}/v2/checkout/orders`, {
    intent: 'CAPTURE',
    purchase_units: [{
      custom_id:   referenceNumber,
      description,
      amount: {
        currency_code: 'PHP',
        value:         totalAmountPhp.toFixed(2),
      },
    }],
    application_context: {
      return_url:          `${process.env.APP_BASE_URL}/payments/success?ref=${referenceNumber}`,
      cancel_url:          `${process.env.APP_BASE_URL}/payments/cancel?ref=${referenceNumber}`,
      brand_name:          'Global Hoops International',
      landing_page:        'NO_PREFERENCE',
      user_action:         'PAY_NOW',
      shipping_preference: 'NO_SHIPPING',
    },
  }, {
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const approvalLink = res.data.links.find((l) => l.rel === 'payer-action' || l.rel === 'approve');
  return { paypalOrderId: res.data.id, approvalUrl: approvalLink.href };
}

/**
 * Capture an approved PayPal order (server-side, after buyer approval).
 *
 * @param {string} paypalOrderId
 * @returns {Promise<{ status: 'PAYMENT_SUCCESS' | 'PAYMENT_PENDING', id: string|null }>}
 */
async function captureOrder(paypalOrderId) {
  const token = await getAccessToken();

  const res = await axios.post(
    `${BASE_URL}/v2/checkout/orders/${paypalOrderId}/capture`,
    {},
    {
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const capture = res.data.purchase_units?.[0]?.payments?.captures?.[0];
  if (res.data.status === 'COMPLETED' && capture?.status === 'COMPLETED') {
    return { status: 'PAYMENT_SUCCESS', id: capture.id };
  }
  return { status: 'PAYMENT_PENDING', id: null };
}

/**
 * Get PayPal order details without capturing (used for reconciliation / cross-verify).
 *
 * @param {string} paypalOrderId
 * @returns {Promise<{ status: 'PAYMENT_SUCCESS' | 'PAYMENT_PENDING' | 'PAYMENT_EXPIRED', id: string|null }>}
 */
async function getOrderDetails(paypalOrderId) {
  const token = await getAccessToken();

  const res = await axios.get(`${BASE_URL}/v2/checkout/orders/${paypalOrderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const capture = res.data.purchase_units?.[0]?.payments?.captures?.[0];
  if (res.data.status === 'COMPLETED' && capture?.status === 'COMPLETED') {
    return { status: 'PAYMENT_SUCCESS', id: capture.id };
  }
  if (res.data.status === 'VOIDED') {
    return { status: 'PAYMENT_EXPIRED', id: null };
  }
  return { status: 'PAYMENT_PENDING', id: null };
}

/**
 * Verify a PayPal webhook signature via PayPal's own API.
 * Returns true if PAYPAL_WEBHOOK_ID is not set (skips verification in dev).
 *
 * @param {Object} headers - req.headers
 * @param {Buffer} rawBody
 * @returns {Promise<boolean>}
 */
async function verifyWebhookSignature(headers, rawBody) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return true;

  try {
    const token = await getAccessToken();
    const res = await axios.post(`${BASE_URL}/v1/notifications/verify-webhook-signature`, {
      auth_algo:         headers['paypal-auth-algo'],
      cert_url:          headers['paypal-cert-url'],
      transmission_id:   headers['paypal-transmission-id'],
      transmission_sig:  headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id:        webhookId,
      webhook_event:     JSON.parse(rawBody.toString('utf8')),
    }, {
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return res.data.verification_status === 'SUCCESS';
  } catch (err) {
    console.error('[paypal] Webhook verification failed:', err.message);
    return false;
  }
}

module.exports = { createOrder, captureOrder, getOrderDetails, verifyWebhookSignature };
