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
// Maya echoes requestReferenceNumber = reservationId (set during checkout).
//
// This handler is the single authoritative place where:
//   • reservation.status  →  "completed"
//   • ticketType.sold     is incremented
//   • Order document      is created
//   • Tickets / QR codes  are generated
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

  // requestReferenceNumber was set to the reservationId in createCheckout()
  const reservationId = event.requestReferenceNumber;
  if (!reservationId) {
    return res.status(400).json({ success: false, message: 'Missing requestReferenceNumber.' });
  }

  try {
    // ── Step 1: Find the TicketReservation ───────────────────────────────────
    const reservation = await TicketReservation.findById(reservationId);

    if (!reservation) {
      // TTL-deleted or bogus id.  Return 200 so Maya stops retrying.
      console.warn('[webhook] Reservation not found:', reservationId);
      return res.json({ success: true, message: 'Reservation not found.' });
    }

    // ── Step 2: Ensure reservation.status is "reserved" ─────────────────────
    if (reservation.status === 'completed') {
      // Idempotency: webhook fired more than once for the same payment.
      const existing = await Order.findOne({ reservationId: reservation._id });
      if (existing?.paymentStatus === 'paid') {
        return res.json({ success: true, message: 'Already processed.' });
      }
      // Completed reservation but no paid order yet — fall through to re-process.
    }

    if (reservation.status === 'expired') {
      console.warn('[webhook] Reservation already expired:', reservationId);
      return res.json({ success: true, message: 'Reservation has expired. Tickets not generated.' });
    }

    // ── Step 3: Ensure reservation.expiresAt is still valid ─────────────────
    if (reservation.expiresAt <= new Date()) {
      // The 30-minute checkout window has passed.
      // Mark the reservation so it is excluded from future availability counts.
      await TicketReservation.findByIdAndUpdate(reservationId, { $set: { status: 'expired' } });
      console.warn('[webhook] Reservation expired at payment time:', reservationId);
      return res.json({
        success: true,
        message: 'Reservation has expired. Tickets not generated.',
      });
    }

    // ── Cross-verify payment status with Maya ────────────────────────────────
    // The reservation carries checkoutId so we don't need an Order to exist yet.
    let mayaPayment;
    try {
      mayaPayment = await getPaymentStatus(reservation.checkoutId);
    } catch (err) {
      console.error('[webhook] Maya verification error:', err.message);
      return res.status(502).json({ success: false, message: 'Could not verify payment with Maya.' });
    }

    const confirmedStatus = mayaPayment.status;

    // =========================================================================
    //  SUCCESS PATH
    // =========================================================================
    if (confirmedStatus === 'PAYMENT_SUCCESS') {

      // ── Step 4: Change reservation.status to "completed" ──────────────────
      // Atomic: only succeeds when status is still 'reserved' AND expiresAt has
      // not passed.  This is the last line of defence against races and
      // last-second expiries between the explicit check above and this write.
      const claimed = await TicketReservation.findOneAndUpdate(
        {
          _id:       reservationId,
          status:    'reserved',
          expiresAt: { $gt: new Date() },
        },
        { $set: { status: 'completed' } },
        { new: true }
      );

      if (!claimed) {
        // Either a concurrent invocation beat us, or the reservation expired in
        // the milliseconds between our check and this update.
        return res.json({ success: true, message: 'Already processed or reservation expired.' });
      }

      // ── Create Order ───────────────────────────────────────────────────────
      const ticketType  = await TicketType.findById(reservation.ticketTypeId);
      const totalAmount = ticketType.price * reservation.quantity;

      const order = await Order.create({
        orderNumber:      generateOrderNumber(),
        gameId:           reservation.gameId,
        ticketTypeId:     reservation.ticketTypeId,
        reservationId:    reservation._id,
        buyerEmail:       reservation.buyerEmail,
        buyerPhone:       reservation.buyerPhone,
        buyerName:        reservation.buyerName,
        quantity:         reservation.quantity,
        totalAmount,
        paymentStatus:    'paid',
        paymentReference: mayaPayment.id ?? reservation.checkoutId,
      });

      // ── Step 5: Increment ticketType.sold by reservation.quantity ──────────
      await TicketType.findByIdAndUpdate(reservation.ticketTypeId, {
        $inc: { sold: reservation.quantity },
      });

      const game = await Game.findById(reservation.gameId);

      // ── Steps 6 · 7 · 8: Generate tickets → QR codes → upload to Cloudinary
      // For family passes (ticketsPerPurchase > 1), generate N QR codes per unit.
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
        // Payment and order are confirmed — returning non-2xx causes Maya to
        // retry indefinitely.  Log for manual recovery instead.
        console.error('[webhook] Ticket generation failed:', err.message);
        return res.status(500).json({
          success: false,
          message: 'Payment recorded but ticket generation failed. Will retry.',
        });
      }

      // ── Step 9: Send email receipt ─────────────────────────────────────────
      sendTicketEmail({
        to:             reservation.buyerEmail,
        buyerName:      reservation.buyerName,
        orderNumber:    order.orderNumber,
        totalAmount:    order.totalAmount,
        ticketTypeName: ticketType.name,
        game,
        tickets,
      }).catch((err) => console.error('[mailer]', err.message));

      // ── Step 10: Send SMS confirmation via Semaphore ───────────────────────
      sendTicketSMS({
        phone:       reservation.buyerPhone,
        buyerName:   reservation.buyerName,
        orderNumber: order.orderNumber,
        game,
      }).catch((err) => console.error('[sms]', err.message));

      return res.json({ success: true, message: 'Payment confirmed. Tickets generated.' });
    }

    // =========================================================================
    //  FAILURE / EXPIRY PATH
    // =========================================================================
    if (confirmedStatus === 'PAYMENT_FAILED' || confirmedStatus === 'PAYMENT_EXPIRED') {
      // Release the reservation immediately — no sold decrement needed because
      // sold is only ever incremented on PAYMENT_SUCCESS above.
      await TicketReservation.findByIdAndUpdate(reservationId, { $set: { status: 'expired' } });
      return res.json({ success: true, message: 'Payment failed. Reservation released.' });
    }

    // Any other status (e.g. PAYMENT_PENDING) — acknowledge without action
    return res.json({ success: true, message: `Unhandled payment status: ${confirmedStatus}` });

  } catch (err) {
    console.error('[webhook]', err);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /payments/process/:reservationId
//
// Client-triggered fallback for when the Maya webhook can't reach the server
// (local dev, firewall, etc.).  Verifies payment status directly with Maya
// and processes the order if confirmed paid.  Safe to call multiple times.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/process/:reservationId', async (req, res) => {
  const { reservationId } = req.params;

  try {
    const reservation = await TicketReservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reservation not found.' });
    }

    // Already processed — just return the existing order + tickets
    if (reservation.status === 'completed') {
      const order = await Order.findOne({ reservationId })
        .populate('gameId',      'description venue gameDate eventEndDate')
        .populate('ticketTypeId', 'name price scope');
      if (!order) {
        // Reservation completed but order not yet written (previous attempt crashed mid-flight).
        // Fall through to re-process below by not returning here.
        console.warn('[process] Completed reservation but no order found — re-processing:', reservationId);
      } else {
        const tickets = await Ticket.find({ orderId: order._id }).sort({ createdAt: 1 });
        return res.json({ success: true, data: { order, tickets } });
      }
    }

    if (!reservation.checkoutId) {
      return res.status(400).json({ success: false, message: 'No checkout initiated for this reservation.' });
    }

    // Verify with Maya (best-effort — API key scope restrictions in sandbox/dev
    // may prevent this call from succeeding, so we treat failures as non-blocking
    // since Maya only redirects to the success URL after PAYMENT_SUCCESS).
    let mayaPaymentId = reservation.checkoutId;
    try {
      const mayaPayment = await getPaymentStatus(reservation.checkoutId);
      console.log('[process] Maya status:', mayaPayment.status);
      if (mayaPayment.status !== 'PAYMENT_SUCCESS') {
        return res.status(402).json({ success: false, message: `Payment status: ${mayaPayment.status}` });
      }
      mayaPaymentId = mayaPayment.id ?? reservation.checkoutId;
    } catch (err) {
      const errCode = err.response?.data?.code;
      console.warn('[process] Maya verification failed:', errCode ?? err.message);
      // In production the webhook is the authoritative handler; only bypass
      // API verification in development where webhooks can't reach localhost.
      if (process.env.NODE_ENV !== 'development') {
        return res.status(502).json({ success: false, message: 'Could not verify payment with Maya.' });
      }
      console.warn('[process] Dev mode — proceeding without Maya verification.');
    }

    // Claim the reservation atomically
    const claimed = await TicketReservation.findOneAndUpdate(
      { _id: reservationId, status: 'reserved' },
      { $set: { status: 'completed' } },
      { new: true }
    );

    if (!claimed) {
      // Race: another process completed it — return the existing order
      const order = await Order.findOne({ reservationId })
        .populate('gameId',      'description venue gameDate eventEndDate')
        .populate('ticketTypeId', 'name price scope');
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not yet available. Please retry.' });
      }
      const tickets = await Ticket.find({ orderId: order._id }).sort({ createdAt: 1 });
      return res.json({ success: true, data: { order, tickets } });
    }

    const ticketType  = await TicketType.findById(reservation.ticketTypeId);
    const totalAmount = ticketType.price * reservation.quantity;

    const order = await Order.create({
      orderNumber:      generateOrderNumber(),
      gameId:           reservation.gameId,
      ticketTypeId:     reservation.ticketTypeId,
      reservationId:    reservation._id,
      buyerEmail:       reservation.buyerEmail,
      buyerPhone:       reservation.buyerPhone,
      buyerName:        reservation.buyerName,
      quantity:         reservation.quantity,
      totalAmount,
      paymentStatus:    'paid',
      paymentReference: mayaPaymentId,
    });

    await TicketType.findByIdAndUpdate(reservation.ticketTypeId, {
      $inc: { sold: reservation.quantity },
    });

    const game = await Game.findById(reservation.gameId);
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

    console.log('[process] Tickets generated successfully:', tickets.length);

    sendTicketEmail({
      to:             reservation.buyerEmail,
      buyerName:      reservation.buyerName,
      orderNumber:    order.orderNumber,
      totalAmount:    order.totalAmount,
      ticketTypeName: ticketType.name,
      game,
      tickets,
    }).catch((err) => console.error('[mailer]', err.message));

    sendTicketSMS({
      phone:       reservation.buyerPhone,
      buyerName:   reservation.buyerName,
      orderNumber: order.orderNumber,
      game,
    }).catch((err) => console.error('[sms]', err.message));

    const populatedOrder = await Order.findById(order._id)
      .populate('gameId',      'description venue gameDate eventEndDate')
      .populate('ticketTypeId', 'name price scope');

    return res.json({ success: true, data: { order: populatedOrder, tickets } });

  } catch (err) {
    console.error('[process]', err);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

module.exports = router;
