const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const TicketType = require('../models/TicketType');
const TicketReservation = require('../models/TicketReservation');
const Game = require('../models/Game');
const { getPaymentStatus } = require('../services/maya');
const { generateTickets } = require('../utils/generateTickets');
const { sendTicketEmail } = require('../services/mailer');
const { sendTicketSMS } = require('../services/sms');
const { generateOrderNumber } = require('../utils/orderNumber');
const Ticket = require('../models/Ticket');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function verifySignature(rawBody, signatureHeader) {
  const secret = process.env.MAYA_WEBHOOK_SECRET;
  if (!secret) return true;        // skip verification in local dev
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signatureHeader, 'hex')
    );
  } catch {
    return false; // buffers differ in length → invalid signature
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /payments/webhook
//
// Maya echoes requestReferenceNumber = cartId (set during checkout).
// Finds all reservations sharing that cartId, creates one Order per reservation,
// generates tickets, then sends one combined email + SMS.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {

  // ── Signature verification ────────────────────────────────────────────────
  const signature = req.headers['x-signature'];
  if (!verifySignature(req.body, signature)) {
    return res.status(401).json({ success: false, message: 'Invalid webhook signature.' });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ success: false, message: 'Invalid JSON payload.' });
  }

  const cartId = event.requestReferenceNumber;
  if (!cartId) {
    return res.status(400).json({ success: false, message: 'Missing requestReferenceNumber.' });
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

    // ── Step 3: Cross-verify payment status with Maya ─────────────────────────
    const checkoutId = reservations[0].checkoutId;
    let mayaPayment;
    try {
      mayaPayment = await getPaymentStatus(checkoutId);
    } catch (err) {
      console.error('[webhook] Maya verification error:', err.message);
      return res.status(502).json({ success: false, message: 'Could not verify payment with Maya.' });
    }

    const confirmedStatus = mayaPayment.status;

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
          paymentReference: mayaPayment.id ?? checkoutId,
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
          return res.status(500).json({
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

      return res.json({ success: true, message: 'Payment confirmed. Tickets generated.' });
    }

    // =========================================================================
    //  FAILURE / EXPIRY PATH
    // =========================================================================
    if (confirmedStatus === 'PAYMENT_FAILED' || confirmedStatus === 'PAYMENT_EXPIRED') {
      await TicketReservation.updateMany({ cartId }, { $set: { status: 'expired' } });
      return res.json({ success: true, message: 'Payment failed. Reservations released.' });
    }

    return res.json({ success: true, message: `Unhandled payment status: ${confirmedStatus}` });

  } catch (err) {
    console.error('[webhook]', err);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
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

    const checkoutId = reservations[0].checkoutId;

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

    if (!checkoutId) {
      return res.status(400).json({ success: false, message: 'No checkout initiated for this cart.' });
    }

    // Verify with Maya
    let mayaPaymentId = checkoutId;
    try {
      const mayaPayment = await getPaymentStatus(checkoutId);
      console.log('[process] Maya status:', mayaPayment.status);
      if (mayaPayment.status !== 'PAYMENT_SUCCESS') {
        return res.status(402).json({ success: false, message: `Payment status: ${mayaPayment.status}` });
      }
      mayaPaymentId = mayaPayment.id ?? checkoutId;
    } catch (err) {
      const errCode = err.response?.data?.code;
      console.warn('[process] Maya verification failed:', errCode ?? err.message);
      if (process.env.NODE_ENV !== 'development') {
        return res.status(502).json({ success: false, message: 'Could not verify payment with Maya.' });
      }
      console.warn('[process] Dev mode — proceeding without Maya verification.');
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
        paymentReference: mayaPaymentId,
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

module.exports = router;
