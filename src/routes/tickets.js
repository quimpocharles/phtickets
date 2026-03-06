const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Game = require('../models/Game');
const TicketType = require('../models/TicketType');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const ScanLog = require('../models/ScanLog');
const TicketReservation = require('../models/TicketReservation');
const adminAuth = require('../middleware/adminAuth');
const { requireScanner } = require('../middleware/roles');
const {
  RESERVATION_TTL_SECONDS,
  CHECKOUT_WINDOW_SECONDS,
} = require('../models/TicketReservation');
const { createCheckout } = require('../services/maya');
const { generateOrderNumber } = require('../utils/orderNumber');

// ─────────────────────────────────────────────────────────────────────────────
// POST /tickets/reserve
//
// Step 1 of checkout: validates availability and holds the seats for 5 minutes.
// Returns a reservationId the client must supply to /tickets/purchase.
//
// Availability formula:
//   available = ticketType.quantity - ticketType.sold - activeReservations
//
// Race-condition guard:
//   TicketType carries a `reservedCount` field that is incremented atomically
//   with findOneAndUpdate + $expr, so two concurrent requests cannot both
//   succeed when there are only N seats left.  The reservation document itself
//   is created inside the same transaction to keep reservedCount in sync.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reserve', async (req, res) => {
  const { ticketTypeId, quantity, buyerEmail, buyerPhone, buyerName, country } = req.body;

  // ── Input validation ──────────────────────────────────────────────────────
  if (!ticketTypeId || !buyerEmail || !buyerPhone) {
    return res.status(400).json({
      success: false,
      message: 'ticketTypeId, buyerEmail, and buyerPhone are required.',
    });
  }

  const qty = parseInt(quantity, 10);
  if (!Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ success: false, message: 'quantity must be a positive integer.' });
  }

  // ── Transaction: availability check + reservation creation ────────────────
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const ticketType = await TicketType.findById(ticketTypeId).session(session);

    if (!ticketType) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Ticket type not found.' });
    }

    // Sum quantities of all live reservations for this ticket type.
    // Runs on the same session so it reads uncommitted data from this transaction.
    const activeReserved = await TicketReservation.countActiveReserved(ticketTypeId, session);
    const available = ticketType.quantity - ticketType.sold - activeReserved;

    if (qty > available) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: available > 0
          ? `Only ${available} ticket(s) available.`
          : 'Tickets for this type are sold out.',
      });
    }

    // Create the reservation inside the transaction so the aggregate above and
    // the insert are committed (or aborted) as one unit.
    const expiresAt = new Date(Date.now() + RESERVATION_TTL_SECONDS * 1000);

    const [reservation] = await TicketReservation.create(
      [
        {
          gameId:      ticketType.gameId,
          ticketTypeId,
          quantity:    qty,
          buyerEmail,
          buyerPhone,
          buyerName:   buyerName || null,
          country:     country || null,
          status:      'reserved',
          expiresAt,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      data: {
        reservationId: reservation._id,
        expiresAt:     reservation.expiresAt,
        ttlSeconds:    RESERVATION_TTL_SECONDS,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  } finally {
    session.endSession();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /tickets/purchase
//
// Single "buy tickets" action that combines the reservation + Maya checkout
// into one request so the client never needs to call two endpoints.
//
// What happens here:
//   1. Availability check  (quantity - sold - activeReservations)
//   2. Create TicketReservation  (status=reserved, expiresAt=+5 min)
//      ↳ ticketType.sold is NOT touched here
//   3. Create Maya checkout using reservationId as requestReferenceNumber
//   4. Extend reservation.expiresAt to +30 min + store checkoutId
//      (so the TTL does not delete the document before Maya fires the webhook)
//   5. Return { reservationId, expiresAt, checkoutId, checkoutUrl }
//
// ticketType.sold is incremented ONLY in the webhook on PAYMENT_SUCCESS.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/purchase', async (req, res) => {
  const { ticketTypeId, quantity, buyerEmail, buyerPhone, buyerName, country } = req.body;

  // ── Input validation ──────────────────────────────────────────────────────
  if (!ticketTypeId || !buyerEmail || !buyerPhone) {
    return res.status(400).json({
      success: false,
      message: 'ticketTypeId, buyerEmail, and buyerPhone are required.',
    });
  }

  const qty = parseInt(quantity, 10);
  if (!Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ success: false, message: 'quantity must be a positive integer.' });
  }

  // ── Phase 1: availability check + create reservation (transaction) ────────
  // ticketType.sold stays unchanged here — seats are held by the reservation.
  const session = await mongoose.startSession();
  session.startTransaction();

  let reservation;

  try {
    const ticketType = await TicketType.findById(ticketTypeId).session(session);
    if (!ticketType) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Ticket type not found.' });
    }

    const activeReserved = await TicketReservation.countActiveReserved(ticketTypeId, session);
    const available = ticketType.quantity - ticketType.sold - activeReserved;

    if (qty > available) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: available > 0
          ? `Only ${available} ticket(s) available.`
          : 'Tickets for this type are sold out.',
      });
    }

    const expiresAt = new Date(Date.now() + RESERVATION_TTL_SECONDS * 1000);

    ;[reservation] = await TicketReservation.create(
      [
        {
          gameId:      ticketType.gameId,
          ticketTypeId,
          quantity:    qty,
          buyerEmail,
          buyerPhone,
          buyerName:   buyerName || null,
          country:     country || null,
          status:      'reserved',
          expiresAt,
        },
      ],
      { session }
    );

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  } finally {
    session.endSession();
  }

  // ── Phase 2: create Maya checkout + anchor the reservation ────────────────
  // Running outside the transaction so a Maya timeout does not roll back the
  // reservation (which would silently un-hold the seats with no feedback).
  try {
    const [game, ticketType] = await Promise.all([
      Game.findById(reservation.gameId, 'description'),
      TicketType.findById(reservation.ticketTypeId, 'name price'),
    ]);

    const totalAmount = ticketType.price * reservation.quantity;
    const description = `${ticketType.name} – ${game.description}`;

    const checkout = await createCheckout({
      referenceNumber: reservation._id.toString(), // echoed back in the webhook
      totalAmount,
      description,
      buyerEmail,
      buyerPhone,
      buyerName,
    });

    // Extend the TTL so MongoDB does not delete the reservation before the
    // webhook fires, and store the checkoutId for cross-verification.
    await TicketReservation.findByIdAndUpdate(reservation._id, {
      checkoutId: checkout.checkoutId,
      expiresAt:  new Date(Date.now() + CHECKOUT_WINDOW_SECONDS * 1000),
    });

    return res.status(201).json({
      success: true,
      data: {
        reservationId: reservation._id,
        expiresAt:     new Date(Date.now() + CHECKOUT_WINDOW_SECONDS * 1000),
        checkoutId:    checkout.checkoutId,
        checkoutUrl:   checkout.redirectUrl,
      },
    });
  } catch (err) {
    // Maya call failed — release the reservation immediately so the seats
    // become available again without waiting for the 5-minute TTL.
    await TicketReservation.findByIdAndUpdate(reservation._id, { status: 'expired' });

    const mayaError = err.response?.data;
    console.error('[purchase] Maya checkout failed:', mayaError ?? err.message);

    return res.status(502).json({
      success: false,
      message: 'Could not initiate payment. Please try again.',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /tickets/order/:reservationId
// Returns order + tickets for a given reservationId (used by the success page).
// Polls-friendly: returns 404 until the webhook has processed the payment.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/order/:reservationId', async (req, res) => {
  try {
    const order = await Order.findOne({ reservationId: req.params.reservationId })
      .populate('gameId',      'description venue gameDate eventEndDate')
      .populate('ticketTypeId', 'name price scope');

    if (!order || order.paymentStatus !== 'paid') {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }

    const tickets = await Ticket.find({ orderId: order._id }).sort({ createdAt: 1 });

    return res.json({ success: true, data: { order, tickets } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /tickets/find?email=&phone=
// Find all paid orders + tickets for a buyer by email + phone.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/find', async (req, res) => {
  const { email, phone } = req.query;

  if (!email || !phone) {
    return res.status(400).json({ success: false, message: 'Email and phone are required.' });
  }

  try {
    const orders = await Order.find({
      buyerEmail:    { $regex: new RegExp(`^${email.trim()}$`, 'i') },
      buyerPhone:    phone.trim(),
      paymentStatus: 'paid',
    })
      .populate('gameId',      'description venue gameDate eventEndDate')
      .populate('ticketTypeId', 'name price scope')
      .sort({ createdAt: -1 });

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'No tickets found for that email and phone number.' });
    }

    const results = await Promise.all(
      orders.map(async (order) => {
        const tickets = await Ticket.find({ orderId: order._id }).sort({ createdAt: 1 });
        return { order, tickets };
      })
    );

    return res.json({ success: true, data: results });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /tickets/verify/:ticketId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/verify/:ticketId', adminAuth, requireScanner, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId })
      .populate({
        path:   'gameId',
        select: 'description venue gameDate eventEndDate',
      })
      .populate('ticketTypeId', 'name price scope')
      .populate('orderId',      'orderNumber buyerName buyerEmail');

    if (!ticket) {
      await ScanLog.create({
        rawTicketId: req.params.ticketId,
        scanResult:  'INVALID',
      }).catch(() => {});

      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    const gameId       = ticket.gameId._id ?? ticket.gameId;
    const ticketTypeId = ticket.ticketTypeId._id ?? ticket.ticketTypeId;
    const scope        = ticket.ticketTypeId?.scope ?? 'day';

    // ── VIP / All-Events pass ─────────────────────────────────────────────────
    if (scope === 'all') {
      const game    = ticket.gameId;
      const phOffset = 8 * 60 * 60 * 1000;
      const phNow   = new Date(Date.now() + phOffset);

      // Derive today's window in UTC by stripping the PH offset
      const todayStartUtc = new Date(
        Date.UTC(phNow.getUTCFullYear(), phNow.getUTCMonth(), phNow.getUTCDate()) - phOffset
      );
      const todayEndUtc = new Date(todayStartUtc.getTime() + 24 * 60 * 60 * 1000 - 1);

      // Check event window
      const eventStart = new Date(game.gameDate);
      eventStart.setHours(0, 0, 0, 0);
      const eventEnd = new Date(game.eventEndDate);
      eventEnd.setHours(23, 59, 59, 999);

      if (phNow < eventStart || phNow > eventEnd) {
        await ScanLog.create({
          ticketId:     ticket._id,
          rawTicketId:  ticket.ticketId,
          gameId,
          ticketTypeId,
          scanResult:   'INVALID',
        }).catch(() => {});

        return res.status(403).json({
          success: false,
          message: `VIP pass is not valid today. Event runs ${
            eventStart.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
          }–${
            eventEnd.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
          }.`,
          data: ticket,
        });
      }

      // Check if already scanned today
      const scannedToday = await ScanLog.findOne({
        ticketId:   ticket._id,
        scanResult: 'VALID',
        scanTime:   { $gte: todayStartUtc, $lte: todayEndUtc },
      });

      if (scannedToday) {
        await ScanLog.create({
          ticketId:     ticket._id,
          rawTicketId:  ticket.ticketId,
          gameId,
          ticketTypeId,
          scanResult:   'ALREADY_USED',
        }).catch(() => {});

        return res.status(409).json({
          success: false,
          message: 'VIP pass already used today.',
          data: ticket,
        });
      }

      // Valid — log entry but do NOT mark ticket as used (active across all event days)
      await ScanLog.create({
        ticketId:     ticket._id,
        rawTicketId:  ticket.ticketId,
        gameId,
        ticketTypeId,
        scanResult:   'VALID',
      }).catch(() => {});

      return res.json({ success: true, message: 'VIP pass valid. Entry granted.', data: ticket });
    }

    // ── Day pass (scope === 'day') ─────────────────────────────────────────────
    if (ticket.status === 'used') {
      await ScanLog.create({
        ticketId:     ticket._id,
        rawTicketId:  ticket.ticketId,
        gameId,
        ticketTypeId,
        scanResult:   'ALREADY_USED',
      }).catch(() => {});

      return res.status(409).json({
        success: false,
        message: 'Ticket has already been used.',
        data: ticket,
      });
    }

    ticket.status = 'used';
    await ticket.save();

    await ScanLog.create({
      ticketId:     ticket._id,
      rawTicketId:  ticket.ticketId,
      gameId,
      ticketTypeId,
      scanResult:   'VALID',
    }).catch(() => {});

    return res.json({ success: true, message: 'Ticket is valid. Entry granted.', data: ticket });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

module.exports = router;
