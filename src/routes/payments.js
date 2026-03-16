const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const TicketType = require('../models/TicketType');
const TicketReservation = require('../models/TicketReservation');
const Game = require('../models/Game');
const PendingCheckout = require('../models/PendingCheckout');
const { getPaymentStatus } = require('../services/paymongo');
const { captureOrder, getOrderDetails, verifyWebhookSignature: verifyPayPalSignature } = require('../services/paypal');
const { generateTickets } = require('../utils/generateTickets');
const { sendTicketEmail, sendTransactionNotification } = require('../services/mailer');
const { sendTicketSMS } = require('../services/sms');
const { generateOrderNumber } = require('../utils/orderNumber');
const Ticket = require('../models/Ticket');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function verifySignature(rawBody, signatureHeader) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret) return true;        // skip verification in local dev
  if (!signatureHeader) return false;

  // PayMongo header format: "t=<timestamp>,te=<hmac256_test>,li=<hmac256_live>"
  const parts = {};
  signatureHeader.split(',').forEach((part) => {
    const [k, v] = part.split('=');
    if (k && v) parts[k.trim()] = v.trim();
  });

  const timestamp = parts.t;
  if (!timestamp) return false;

  const computed = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest('hex');

  // te = test-mode hash, li = live-mode hash; try both
  const candidates = [parts.te, parts.li].filter(Boolean);
  return candidates.some((candidate) => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(computed, 'hex'),
        Buffer.from(candidate, 'hex')
      );
    } catch {
      return false;
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /payments/webhook
//
// PayMongo sends checkout_session.payment.paid when a session is paid.
// reference_number = cartId (set during checkout).
// Finds all reservations sharing that cartId, creates one Order per reservation,
// generates tickets, then sends one combined email + SMS.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {

  // ── Signature verification ────────────────────────────────────────────────
  const signature = req.headers['paymongo-signature'];
  if (!verifySignature(req.body, signature)) {
    console.warn('[webhook] Invalid signature — ignoring.');
    return res.json({ success: false, message: 'Invalid webhook signature.' });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    console.warn('[webhook] Invalid JSON payload — ignoring.');
    return res.json({ success: false, message: 'Invalid JSON payload.' });
  }

  const cartId = event.data?.attributes?.data?.attributes?.reference_number;
  if (!cartId) {
    console.warn('[webhook] Missing reference_number — ignoring.');
    return res.json({ success: false, message: 'Missing reference_number.' });
  }

  try {
    // ── Step 1: Find all reservations for this cart ───────────────────────────
    const reservations = await TicketReservation.find({ cartId });

    if (!reservations.length) {
      console.warn('[webhook] Cart not found:', cartId);
      return res.json({ success: true, message: 'Cart not found.' });
    }

    // ── Step 2: Idempotency — check if already fully processed ───────────────
    const existingOrders = await Order.find({
      reservationId: { $in: reservations.map((r) => r._id) },
      paymentStatus: 'paid',
    });
    if (existingOrders.length === reservations.length) {
      return res.json({ success: true, message: 'Already processed.' });
    }

    if (reservations.some((r) => r.status === 'expired')) {
      return res.json({ success: true, message: 'One or more reservations have expired.' });
    }

    // ── Step 3: Cross-verify payment status with PayMongo ────────────────────
    const checkoutId = reservations[0].checkoutId;
    let paymongoPayment;
    try {
      paymongoPayment = await getPaymentStatus(checkoutId);
    } catch (err) {
      console.error('[webhook] PayMongo verification error:', err.message);
      // Return 200 so PayMongo does not disable the webhook — we log for manual follow-up
      return res.json({ success: false, message: 'Could not verify payment with PayMongo.' });
    }

    const confirmedStatus = paymongoPayment.status;

    // =========================================================================
    //  SUCCESS PATH
    // =========================================================================
    if (confirmedStatus === 'PAYMENT_SUCCESS') {

      // ── Step 4: Atomically claim all reservations ─────────────────────────
      const claimResult = await TicketReservation.updateMany(
        { cartId, status: 'reserved', expiresAt: { $gt: new Date() } },
        { $set: { status: 'completed' } }
      );

      if (claimResult.modifiedCount === 0) {
        return res.json({ success: true, message: 'Already processed or reservations expired.' });
      }

      const game        = await Game.findById(reservations[0].gameId);
      const allTickets  = [];  // flat list of all generated tickets with metadata
      const firstOrderNumber = generateOrderNumber(); // used in SMS; we use the first order's number

      let firstOrder;

      // ── Step 5–8: For each reservation, create Order + generate tickets ────
      for (const reservation of reservations) {
        const ticketType  = await TicketType.findById(reservation.ticketTypeId);
        const totalAmount = (ticketType.price + (ticketType.serviceFee ?? 0)) * reservation.quantity;

        const order = await Order.create({
          orderNumber:      generateOrderNumber(),
          gameId:           reservation.gameId,
          ticketTypeId:     reservation.ticketTypeId,
          reservationId:    reservation._id,
          buyerEmail:       reservation.buyerEmail,
          buyerPhone:       reservation.buyerPhone,
          buyerName:        reservation.buyerName,
          country:          reservation.country ?? null,
          quantity:         reservation.quantity,
          totalAmount,
          paymentStatus:    'paid',
          paymentReference: paymongoPayment.id ?? checkoutId,
        });

        if (!firstOrder) firstOrder = order;

        await TicketType.findByIdAndUpdate(reservation.ticketTypeId, {
          $inc: { sold: reservation.quantity },
        });

        const totalTickets = reservation.quantity * (ticketType.ticketsPerPurchase ?? 1);
        let tickets;
        try {
          tickets = await generateTickets({
            orderId:      order._id,
            gameId:       reservation.gameId,
            ticketTypeId: reservation.ticketTypeId,
            quantity:     totalTickets,
          });
        } catch (err) {
          console.error('[webhook] Ticket generation failed for reservation:', reservation._id, err.message);
          // Return 200 so PayMongo doesn't disable the webhook; payment is already recorded
          return res.json({
            success: false,
            message: 'Payment recorded but ticket generation failed. Will retry.',
          });
        }

        for (const t of tickets) {
          allTickets.push({ ...t.toObject(), ticketTypeName: ticketType.name, ticketTypeScope: ticketType.scope, orderNumber: order.orderNumber });
        }
      }

      // ── Step 9: Send ONE combined email with all tickets ───────────────────
      const createdOrders = await Order.find({
        reservationId: { $in: reservations.map((r) => r._id) },
        paymentStatus: 'paid',
      });
      const grandTotalCalc = createdOrders.reduce((sum, o) => sum + o.totalAmount, 0);

      sendTicketEmail({
        to:          reservations[0].buyerEmail,
        buyerName:   reservations[0].buyerName,
        game,
        grandTotal:  grandTotalCalc,
        allTickets,
      }).catch((err) => console.error('[mailer]', err.message));

      // ── Step 10: Send SMS ──────────────────────────────────────────────────
      sendTicketSMS({
        phone:       reservations[0].buyerPhone,
        buyerName:   reservations[0].buyerName,
        orderNumber: firstOrder.orderNumber,
        game,
      }).catch((err) => console.error('[sms]', err.message));

      // ── Step 11: Notify EOD recipients of confirmed transaction ───────────
      sendTransactionNotification({
        game,
        buyerName:  reservations[0].buyerName,
        buyerEmail: reservations[0].buyerEmail,
        grandTotal: grandTotalCalc,
        allTickets,
      }).catch((err) => console.error('[mailer] transaction notification:', err.message));

      // ── Step 12: Mark PendingCheckout as processed ────────────────────────
      PendingCheckout.findOneAndUpdate(
        { cartId },
        { status: 'processed', processedAt: new Date() }
      ).catch((err) => console.error('[webhook] PendingCheckout update failed:', err.message));

      return res.json({ success: true, message: 'Payment confirmed. Passes generated.' });
    }

    // =========================================================================
    //  FAILURE / EXPIRY PATH
    // =========================================================================
    if (confirmedStatus === 'PAYMENT_EXPIRED' || confirmedStatus === 'PAYMENT_PENDING') {
      await TicketReservation.updateMany({ cartId }, { $set: { status: 'expired' } });
      return res.json({ success: true, message: 'Payment not confirmed. Reservations released.' });
    }

    return res.json({ success: true, message: `Unhandled payment status: ${confirmedStatus}` });

  } catch (err) {
    console.error('[webhook]', err);
    return res.json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /payments/process/:cartId
//
// Client-triggered fallback for local dev (when webhooks can't reach localhost).
// Processes all reservations in the cart.  Safe to call multiple times.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/process/:cartId', async (req, res) => {
  const { cartId } = req.params;

  try {
    const reservations = await TicketReservation.find({ cartId });
    if (!reservations.length) {
      return res.status(404).json({ success: false, message: 'Cart not found.' });
    }

    const checkoutId    = reservations[0].checkoutId;
    const paypalOrderId = reservations[0].paypalOrderId;
    const isPayPal      = reservations[0].paymentMethod === 'paypal';

    // Already fully processed — return existing cart data
    const existingOrders = await Order.find({
      reservationId: { $in: reservations.map((r) => r._id) },
      paymentStatus: 'paid',
    });
    if (existingOrders.length === reservations.length) {
      // Re-use the /order/cart/:cartId response shape
      const orderIds   = existingOrders.map((o) => o._id);
      const allTickets = await Ticket.find({ orderId: { $in: orderIds } }).sort({ createdAt: 1 });
      const ticketsByOrder = new Map();
      for (const t of allTickets) {
        const key = t.orderId.toString();
        if (!ticketsByOrder.has(key)) ticketsByOrder.set(key, []);
        ticketsByOrder.get(key).push(t);
      }
      const populatedOrders = await Order.find({ _id: { $in: orderIds } })
        .populate('gameId', 'description venue gameDate eventEndDate')
        .populate('ticketTypeId', 'name price scope');
      return res.json({
        success: true,
        data: {
          game:       populatedOrders[0].gameId,
          buyer:      { name: populatedOrders[0].buyerName, email: populatedOrders[0].buyerEmail },
          grandTotal: populatedOrders.reduce((s, o) => s + o.totalAmount, 0),
          orders:     populatedOrders.map((o) => ({
            orderNumber:     o.orderNumber,
            ticketTypeName:  o.ticketTypeId.name,
            ticketTypeScope: o.ticketTypeId.scope,
            quantity:        o.quantity,
            totalAmount:     o.totalAmount,
            tickets:         ticketsByOrder.get(o._id.toString()) ?? [],
          })),
        },
      });
    }

    // Verify with payment provider
    let paymentReference = checkoutId ?? paypalOrderId;

    if (isPayPal) {
      if (!paypalOrderId) {
        return res.status(400).json({ success: false, message: 'No PayPal order found for this cart.' });
      }
      try {
        // Try capture first (succeeds if order is APPROVED but not yet captured)
        let paypalPayment;
        try {
          paypalPayment = await captureOrder(paypalOrderId);
        } catch {
          // Already captured or invalid — fall back to read-only status check
          paypalPayment = await getOrderDetails(paypalOrderId);
        }
        console.log('[process] PayPal status:', paypalPayment.status);
        if (paypalPayment.status !== 'PAYMENT_SUCCESS') {
          return res.status(402).json({ success: false, message: `Payment status: ${paypalPayment.status}` });
        }
        paymentReference = paypalPayment.id ?? paypalOrderId;
      } catch (err) {
        console.warn('[process] PayPal verification failed:', err.message);
        if (process.env.NODE_ENV !== 'development') {
          return res.status(502).json({ success: false, message: 'Could not verify PayPal payment.' });
        }
        console.warn('[process] Dev mode — proceeding without PayPal verification.');
      }
    } else {
      if (!checkoutId) {
        return res.status(400).json({ success: false, message: 'No checkout initiated for this cart.' });
      }
      try {
        const paymongoPayment = await getPaymentStatus(checkoutId);
        console.log('[process] PayMongo status:', paymongoPayment.status);
        if (paymongoPayment.status !== 'PAYMENT_SUCCESS') {
          return res.status(402).json({ success: false, message: `Payment status: ${paymongoPayment.status}` });
        }
        paymentReference = paymongoPayment.id ?? checkoutId;
      } catch (err) {
        const errCode = err.response?.data?.errors?.[0]?.code;
        console.warn('[process] PayMongo verification failed:', errCode ?? err.message);
        if (process.env.NODE_ENV !== 'development') {
          return res.status(502).json({ success: false, message: 'Could not verify payment with PayMongo.' });
        }
        console.warn('[process] Dev mode — proceeding without PayMongo verification.');
      }
    }

    // Claim all reservations atomically
    const claimResult = await TicketReservation.updateMany(
      { cartId, status: 'reserved' },
      { $set: { status: 'completed' } }
    );

    if (claimResult.modifiedCount === 0 && existingOrders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not yet available. Please retry.' });
    }

    const game       = await Game.findById(reservations[0].gameId);
    const allTickets = [];
    const createdOrders = [];
    let firstOrder;

    for (const reservation of reservations) {
      const ticketType  = await TicketType.findById(reservation.ticketTypeId);
      const totalAmount = (ticketType.price + (ticketType.serviceFee ?? 0)) * reservation.quantity;

      // Skip if order already exists for this reservation
      const alreadyDone = await Order.findOne({ reservationId: reservation._id, paymentStatus: 'paid' });
      if (alreadyDone) {
        const existingTickets = await Ticket.find({ orderId: alreadyDone._id });
        for (const t of existingTickets) {
          allTickets.push({ ...t.toObject(), ticketTypeName: ticketType.name, ticketTypeScope: ticketType.scope, orderNumber: alreadyDone.orderNumber });
        }
        createdOrders.push(alreadyDone);
        if (!firstOrder) firstOrder = alreadyDone;
        continue;
      }

      const order = await Order.create({
        orderNumber:      generateOrderNumber(),
        gameId:           reservation.gameId,
        ticketTypeId:     reservation.ticketTypeId,
        reservationId:    reservation._id,
        buyerEmail:       reservation.buyerEmail,
        buyerPhone:       reservation.buyerPhone,
        buyerName:        reservation.buyerName,
        country:          reservation.country ?? null,
        quantity:         reservation.quantity,
        totalAmount,
        paymentStatus:    'paid',
        paymentReference,
      });

      if (!firstOrder) firstOrder = order;
      createdOrders.push(order);

      await TicketType.findByIdAndUpdate(reservation.ticketTypeId, {
        $inc: { sold: reservation.quantity },
      });

      const totalTickets = reservation.quantity * (ticketType.ticketsPerPurchase ?? 1);
      console.log('[process] Generating', totalTickets, 'ticket(s) for order', order._id);

      let tickets;
      try {
        tickets = await generateTickets({
          orderId:      order._id,
          gameId:       reservation.gameId,
          ticketTypeId: reservation.ticketTypeId,
          quantity:     totalTickets,
        });
      } catch (err) {
        console.error('[process] Ticket generation failed:', err.message);
        return res.status(500).json({ success: false, message: 'Ticket generation failed. Please contact support.' });
      }

      for (const t of tickets) {
        allTickets.push({ ...t.toObject(), ticketTypeName: ticketType.name, ticketTypeScope: ticketType.scope, orderNumber: order.orderNumber });
      }
    }

    const grandTotal = createdOrders.reduce((s, o) => s + o.totalAmount, 0);

    sendTicketEmail({
      to:         reservations[0].buyerEmail,
      buyerName:  reservations[0].buyerName,
      game,
      grandTotal,
      allTickets,
    }).catch((err) => console.error('[mailer]', err.message));

    sendTicketSMS({
      phone:       reservations[0].buyerPhone,
      buyerName:   reservations[0].buyerName,
      orderNumber: firstOrder.orderNumber,
      game,
    }).catch((err) => console.error('[sms]', err.message));

    sendTransactionNotification({
      game,
      buyerName:  reservations[0].buyerName,
      buyerEmail: reservations[0].buyerEmail,
      grandTotal,
      allTickets,
    }).catch((err) => console.error('[mailer] transaction notification:', err.message));

    // Mark PendingCheckout as processed
    PendingCheckout.findOneAndUpdate(
      { cartId },
      { status: 'processed', processedAt: new Date() }
    ).catch((err) => console.error('[process] PendingCheckout update failed:', err.message));

    // Build response in same shape as /order/cart/:cartId
    const ticketsByOrder = new Map();
    for (const t of allTickets) {
      if (!ticketsByOrder.has(t.orderNumber)) ticketsByOrder.set(t.orderNumber, []);
      ticketsByOrder.get(t.orderNumber).push(t);
    }

    const populatedOrders = await Order.find({ _id: { $in: createdOrders.map((o) => o._id) } })
      .populate('gameId', 'description venue gameDate eventEndDate')
      .populate('ticketTypeId', 'name price scope');

    return res.json({
      success: true,
      data: {
        game:       populatedOrders[0].gameId,
        buyer:      { name: reservations[0].buyerName, email: reservations[0].buyerEmail },
        grandTotal,
        orders:     populatedOrders.map((o) => ({
          orderNumber:     o.orderNumber,
          ticketTypeName:  o.ticketTypeId.name,
          ticketTypeScope: o.ticketTypeId.scope,
          quantity:        o.quantity,
          totalAmount:     o.totalAmount,
          tickets:         ticketsByOrder.get(o.orderNumber) ?? [],
        })),
      },
    });

  } catch (err) {
    console.error('[process]', err);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /payments/paypal/capture
//
// Called by the success page after PayPal redirects back with ?token=<paypalOrderId>.
// Captures the payment, creates orders, generates tickets, and returns the
// same response shape as GET /tickets/order/cart/:cartId.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/paypal/capture', async (req, res) => {
  const { cartId } = req.body;

  if (!cartId) {
    return res.status(400).json({ success: false, message: 'cartId is required.' });
  }

  try {
    const reservations = await TicketReservation.find({ cartId });
    if (!reservations.length) {
      return res.status(404).json({ success: false, message: 'Cart not found.' });
    }

    const paypalOrderId = reservations[0].paypalOrderId;
    if (!paypalOrderId) {
      return res.status(400).json({ success: false, message: 'Not a PayPal cart.' });
    }

    // ── Idempotency ───────────────────────────────────────────────────────────
    const existingOrders = await Order.find({
      reservationId: { $in: reservations.map((r) => r._id) },
      paymentStatus: 'paid',
    });
    if (existingOrders.length === reservations.length) {
      // Already processed — return the existing data
      const orderIds   = existingOrders.map((o) => o._id);
      const allTickets = await Ticket.find({ orderId: { $in: orderIds } }).sort({ createdAt: 1 });
      const populatedOrders = await Order.find({ _id: { $in: orderIds } })
        .populate('gameId',      'description venue gameDate eventEndDate')
        .populate('ticketTypeId', 'name price scope');
      const ticketsByOrder = new Map();
      for (const t of allTickets) {
        const key = t.orderId.toString();
        if (!ticketsByOrder.has(key)) ticketsByOrder.set(key, []);
        ticketsByOrder.get(key).push(t);
      }
      return res.json({
        success: true,
        data: {
          game:       populatedOrders[0].gameId,
          buyer:      { name: populatedOrders[0].buyerName, email: populatedOrders[0].buyerEmail },
          grandTotal: populatedOrders.reduce((s, o) => s + o.totalAmount, 0),
          orders:     populatedOrders.map((o) => ({
            orderNumber:     o.orderNumber,
            ticketTypeName:  o.ticketTypeId.name,
            ticketTypeScope: o.ticketTypeId.scope,
            quantity:        o.quantity,
            totalAmount:     o.totalAmount,
            tickets:         ticketsByOrder.get(o._id.toString()) ?? [],
          })),
        },
      });
    }

    if (reservations.some((r) => r.status === 'expired')) {
      return res.status(410).json({ success: false, message: 'Reservation has expired.' });
    }

    // ── Capture payment ───────────────────────────────────────────────────────
    let paypalPayment;
    try {
      paypalPayment = await captureOrder(paypalOrderId);
    } catch (captureErr) {
      // May already be captured (e.g. webhook fired first) — try read-only check
      try {
        paypalPayment = await getOrderDetails(paypalOrderId);
      } catch (err) {
        console.error('[paypal/capture] Could not verify payment:', err.message);
        return res.status(502).json({ success: false, message: 'Could not verify PayPal payment.' });
      }
    }

    if (paypalPayment.status !== 'PAYMENT_SUCCESS') {
      return res.status(402).json({ success: false, message: `Payment status: ${paypalPayment.status}` });
    }

    // ── Claim all reservations ────────────────────────────────────────────────
    const claimResult = await TicketReservation.updateMany(
      { cartId, status: 'reserved', expiresAt: { $gt: new Date() } },
      { $set: { status: 'completed' } }
    );

    if (claimResult.modifiedCount === 0 && existingOrders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not yet available. Please retry.' });
    }

    const game        = await Game.findById(reservations[0].gameId);
    const allTickets  = [];
    const createdOrders = [];
    let firstOrder;

    for (const reservation of reservations) {
      const ticketType  = await TicketType.findById(reservation.ticketTypeId);
      const totalAmount = (ticketType.price + (ticketType.serviceFee ?? 0)) * reservation.quantity;

      const alreadyDone = await Order.findOne({ reservationId: reservation._id, paymentStatus: 'paid' });
      if (alreadyDone) {
        const existingTickets = await Ticket.find({ orderId: alreadyDone._id });
        for (const t of existingTickets) {
          allTickets.push({ ...t.toObject(), ticketTypeName: ticketType.name, ticketTypeScope: ticketType.scope, orderNumber: alreadyDone.orderNumber });
        }
        createdOrders.push(alreadyDone);
        if (!firstOrder) firstOrder = alreadyDone;
        continue;
      }

      const order = await Order.create({
        orderNumber:      generateOrderNumber(),
        gameId:           reservation.gameId,
        ticketTypeId:     reservation.ticketTypeId,
        reservationId:    reservation._id,
        buyerEmail:       reservation.buyerEmail,
        buyerPhone:       reservation.buyerPhone,
        buyerName:        reservation.buyerName,
        country:          reservation.country ?? null,
        quantity:         reservation.quantity,
        totalAmount,
        paymentStatus:    'paid',
        paymentReference: paypalPayment.id ?? paypalOrderId,
      });

      if (!firstOrder) firstOrder = order;
      createdOrders.push(order);

      await TicketType.findByIdAndUpdate(reservation.ticketTypeId, {
        $inc: { sold: reservation.quantity },
      });

      const totalTickets = reservation.quantity * (ticketType.ticketsPerPurchase ?? 1);
      let tickets;
      try {
        tickets = await generateTickets({
          orderId:      order._id,
          gameId:       reservation.gameId,
          ticketTypeId: reservation.ticketTypeId,
          quantity:     totalTickets,
        });
      } catch (err) {
        console.error('[paypal/capture] Ticket generation failed:', err.message);
        return res.status(500).json({ success: false, message: 'Ticket generation failed. Please contact support.' });
      }

      for (const t of tickets) {
        allTickets.push({ ...t.toObject(), ticketTypeName: ticketType.name, ticketTypeScope: ticketType.scope, orderNumber: order.orderNumber });
      }
    }

    const grandTotal = createdOrders.reduce((s, o) => s + o.totalAmount, 0);

    sendTicketEmail({
      to:         reservations[0].buyerEmail,
      buyerName:  reservations[0].buyerName,
      game,
      grandTotal,
      allTickets,
    }).catch((err) => console.error('[mailer]', err.message));

    sendTicketSMS({
      phone:       reservations[0].buyerPhone,
      buyerName:   reservations[0].buyerName,
      orderNumber: firstOrder.orderNumber,
      game,
    }).catch((err) => console.error('[sms]', err.message));

    sendTransactionNotification({
      game,
      buyerName:  reservations[0].buyerName,
      buyerEmail: reservations[0].buyerEmail,
      grandTotal,
      allTickets,
    }).catch((err) => console.error('[mailer] transaction notification:', err.message));

    PendingCheckout.findOneAndUpdate(
      { cartId },
      { status: 'processed', processedAt: new Date() }
    ).catch((err) => console.error('[paypal/capture] PendingCheckout update failed:', err.message));

    const ticketsByOrder = new Map();
    for (const t of allTickets) {
      if (!ticketsByOrder.has(t.orderNumber)) ticketsByOrder.set(t.orderNumber, []);
      ticketsByOrder.get(t.orderNumber).push(t);
    }

    const populatedOrders = await Order.find({ _id: { $in: createdOrders.map((o) => o._id) } })
      .populate('gameId',      'description venue gameDate eventEndDate')
      .populate('ticketTypeId', 'name price scope');

    return res.json({
      success: true,
      data: {
        game:       populatedOrders[0].gameId,
        buyer:      { name: reservations[0].buyerName, email: reservations[0].buyerEmail },
        grandTotal,
        orders:     populatedOrders.map((o) => ({
          orderNumber:     o.orderNumber,
          ticketTypeName:  o.ticketTypeId.name,
          ticketTypeScope: o.ticketTypeId.scope,
          quantity:        o.quantity,
          totalAmount:     o.totalAmount,
          tickets:         ticketsByOrder.get(o.orderNumber) ?? [],
        })),
      },
    });

  } catch (err) {
    console.error('[paypal/capture]', err);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /payments/paypal/webhook
//
// PayPal sends PAYMENT.CAPTURE.COMPLETED when a capture completes.
// This is the reliability layer in case the client-side capture call fails.
// ALWAYS returns 200 — returning 4xx/5xx causes PayPal to retry and
// eventually disable the webhook.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/paypal/webhook', express.raw({ type: 'application/json' }), async (req, res) => {

  // ── Signature verification ─────────────────────────────────────────────────
  const valid = await verifyPayPalSignature(req.headers, req.body).catch(() => false);
  if (!valid) {
    console.warn('[paypal/webhook] Invalid signature — ignoring.');
    return res.json({ success: false, message: 'Invalid webhook signature.' });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    console.warn('[paypal/webhook] Invalid JSON — ignoring.');
    return res.json({ success: false, message: 'Invalid JSON payload.' });
  }

  if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
    return res.json({ success: true, message: `Unhandled event: ${event.event_type}` });
  }

  // ── Extract PayPal order ID ────────────────────────────────────────────────
  const paypalOrderId = event.resource?.supplementary_data?.related_ids?.order_id;
  if (!paypalOrderId) {
    console.warn('[paypal/webhook] Missing order_id in event — ignoring.');
    return res.json({ success: false, message: 'Missing order_id.' });
  }

  try {
    const reservations = await TicketReservation.find({ paypalOrderId });
    if (!reservations.length) {
      console.warn('[paypal/webhook] No reservations for paypalOrderId:', paypalOrderId);
      return res.json({ success: true, message: 'No reservations found.' });
    }

    const cartId = reservations[0].cartId;

    // ── Idempotency ────────────────────────────────────────────────────────────
    const existingOrders = await Order.find({
      reservationId: { $in: reservations.map((r) => r._id) },
      paymentStatus: 'paid',
    });
    if (existingOrders.length === reservations.length) {
      return res.json({ success: true, message: 'Already processed.' });
    }

    if (reservations.some((r) => r.status === 'expired')) {
      return res.json({ success: true, message: 'Reservations expired.' });
    }

    // ── Cross-verify with PayPal ───────────────────────────────────────────────
    let paypalPayment;
    try {
      paypalPayment = await getOrderDetails(paypalOrderId);
    } catch (err) {
      console.error('[paypal/webhook] PayPal verify error:', err.message);
      return res.json({ success: false, message: 'Could not verify payment with PayPal.' });
    }

    if (paypalPayment.status !== 'PAYMENT_SUCCESS') {
      return res.json({ success: true, message: `Payment not confirmed: ${paypalPayment.status}` });
    }

    // ── Claim all reservations ─────────────────────────────────────────────────
    const claimResult = await TicketReservation.updateMany(
      { cartId, status: 'reserved', expiresAt: { $gt: new Date() } },
      { $set: { status: 'completed' } }
    );

    if (claimResult.modifiedCount === 0) {
      return res.json({ success: true, message: 'Already processed or reservations expired.' });
    }

    const game       = await Game.findById(reservations[0].gameId);
    const allTickets = [];
    let firstOrder;

    for (const reservation of reservations) {
      const ticketType  = await TicketType.findById(reservation.ticketTypeId);
      const totalAmount = (ticketType.price + (ticketType.serviceFee ?? 0)) * reservation.quantity;

      const order = await Order.create({
        orderNumber:      generateOrderNumber(),
        gameId:           reservation.gameId,
        ticketTypeId:     reservation.ticketTypeId,
        reservationId:    reservation._id,
        buyerEmail:       reservation.buyerEmail,
        buyerPhone:       reservation.buyerPhone,
        buyerName:        reservation.buyerName,
        country:          reservation.country ?? null,
        quantity:         reservation.quantity,
        totalAmount,
        paymentStatus:    'paid',
        paymentReference: paypalPayment.id ?? paypalOrderId,
      });

      if (!firstOrder) firstOrder = order;

      await TicketType.findByIdAndUpdate(reservation.ticketTypeId, {
        $inc: { sold: reservation.quantity },
      });

      const totalTickets = reservation.quantity * (ticketType.ticketsPerPurchase ?? 1);
      let tickets;
      try {
        tickets = await generateTickets({
          orderId:      order._id,
          gameId:       reservation.gameId,
          ticketTypeId: reservation.ticketTypeId,
          quantity:     totalTickets,
        });
      } catch (err) {
        console.error('[paypal/webhook] Ticket generation failed:', err.message);
        return res.json({ success: false, message: 'Payment recorded but ticket generation failed.' });
      }

      for (const t of tickets) {
        allTickets.push({ ...t.toObject(), ticketTypeName: ticketType.name, ticketTypeScope: ticketType.scope, orderNumber: order.orderNumber });
      }
    }

    const createdOrders  = await Order.find({ reservationId: { $in: reservations.map((r) => r._id) }, paymentStatus: 'paid' });
    const grandTotalCalc = createdOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    sendTicketEmail({
      to:         reservations[0].buyerEmail,
      buyerName:  reservations[0].buyerName,
      game,
      grandTotal: grandTotalCalc,
      allTickets,
    }).catch((err) => console.error('[mailer]', err.message));

    sendTicketSMS({
      phone:       reservations[0].buyerPhone,
      buyerName:   reservations[0].buyerName,
      orderNumber: firstOrder.orderNumber,
      game,
    }).catch((err) => console.error('[sms]', err.message));

    sendTransactionNotification({
      game,
      buyerName:  reservations[0].buyerName,
      buyerEmail: reservations[0].buyerEmail,
      grandTotal: grandTotalCalc,
      allTickets,
    }).catch((err) => console.error('[mailer] transaction notification:', err.message));

    PendingCheckout.findOneAndUpdate(
      { cartId },
      { status: 'processed', processedAt: new Date() }
    ).catch((err) => console.error('[paypal/webhook] PendingCheckout update failed:', err.message));

    return res.json({ success: true, message: 'PayPal payment confirmed. Passes generated.' });

  } catch (err) {
    console.error('[paypal/webhook]', err);
    return res.json({ success: false, message: 'An unexpected error occurred.' });
  }
});

module.exports = router;
