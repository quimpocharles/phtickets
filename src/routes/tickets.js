const crypto = require('crypto');
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
const { createCheckout } = require('../services/paymongo');
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
// Multi-item cart purchase. Accepts an array of { ticketTypeId, quantity } items.
// A shared cartId (UUID) is generated and stored on all reservations, and is used
// as Maya's requestReferenceNumber so the webhook can find all reservations.
//
// Flow:
//   1. Validate all items
//   2. In one transaction: check availability for each item, create all reservations
//   3. Create one Maya checkout for the combined total (cartId as reference)
//   4. Extend all reservations' TTL + store checkoutId
//   5. Return { cartId, expiresAt, checkoutId, checkoutUrl }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/purchase', async (req, res) => {
  const { items, buyerEmail, buyerPhone, buyerName, country } = req.body;

  // ── Input validation ──────────────────────────────────────────────────────
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'items must be a non-empty array.' });
  }
  if (!buyerEmail || !buyerPhone) {
    return res.status(400).json({ success: false, message: 'buyerEmail and buyerPhone are required.' });
  }

  const normalizedItems = [];
  for (const item of items) {
    const qty = parseInt(item.quantity, 10);
    if (!item.ticketTypeId || !Number.isInteger(qty) || qty < 1) {
      return res.status(400).json({ success: false, message: 'Each item needs a ticketTypeId and a positive quantity.' });
    }
    normalizedItems.push({ ticketTypeId: item.ticketTypeId, quantity: qty });
  }

  // cartId is the single reference tying all reservations + Maya checkout together
  const cartId   = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + RESERVATION_TTL_SECONDS * 1000);

  // ── Phase 1: availability check + create all reservations (transaction) ───
  const session = await mongoose.startSession();
  session.startTransaction();

  let reservations;
  let ticketTypeMap;

  try {
    const ids         = normalizedItems.map((i) => i.ticketTypeId);
    const ticketTypes = await TicketType.find({ _id: { $in: ids } }).session(session);

    if (ticketTypes.length !== normalizedItems.length) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'One or more ticket types not found.' });
    }

    ticketTypeMap = new Map(ticketTypes.map((tt) => [tt._id.toString(), tt]));

    for (const item of normalizedItems) {
      const tt            = ticketTypeMap.get(item.ticketTypeId);
      const activeReserved = await TicketReservation.countActiveReserved(item.ticketTypeId, session);
      const available     = tt.quantity - tt.sold - activeReserved;

      if (item.quantity > available) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: available > 0
            ? `Only ${available} ticket(s) available for ${tt.name}.`
            : `${tt.name} is sold out.`,
        });
      }
    }

    const docs = normalizedItems.map((item) => {
      const tt = ticketTypeMap.get(item.ticketTypeId);
      return {
        cartId,
        gameId:      tt.gameId,
        ticketTypeId: item.ticketTypeId,
        quantity:    item.quantity,
        buyerEmail,
        buyerPhone,
        buyerName:   buyerName || null,
        country:     country  || null,
        status:      'reserved',
        expiresAt,
      };
    });

    reservations = await TicketReservation.create(docs, { session, ordered: true });
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    console.error('[purchase] Phase 1 error:', err);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  } finally {
    session.endSession();
  }

  // ── Phase 2: create Maya checkout + anchor all reservations ───────────────
  try {
    const game        = await Game.findById(reservations[0].gameId, 'description');
    const totalAmount = normalizedItems.reduce((sum, item) => {
      const tt = ticketTypeMap.get(item.ticketTypeId);
      return sum + (tt.price + (tt.serviceFee ?? 0)) * item.quantity;
    }, 0);
    const description = normalizedItems.length === 1
      ? `${ticketTypeMap.get(normalizedItems[0].ticketTypeId).name} – ${game.description}`
      : `${game.description} (${normalizedItems.length} ticket types)`;

    const checkout = await createCheckout({
      referenceNumber: cartId,
      totalAmount,
      description,
      buyerEmail,
      buyerPhone,
      buyerName,
    });

    await TicketReservation.updateMany(
      { cartId },
      {
        checkoutId: checkout.checkoutId,
        expiresAt:  new Date(Date.now() + CHECKOUT_WINDOW_SECONDS * 1000),
      }
    );

    return res.status(201).json({
      success: true,
      data: {
        cartId,
        expiresAt:   new Date(Date.now() + CHECKOUT_WINDOW_SECONDS * 1000),
        checkoutId:  checkout.checkoutId,
        checkoutUrl: checkout.redirectUrl,
      },
    });
  } catch (err) {
    await TicketReservation.updateMany({ cartId }, { status: 'expired' });
    const pmError = err.response?.data?.errors?.[0];
    console.error('[purchase] PayMongo checkout failed:', pmError ?? err.message);
    return res.status(502).json({ success: false, message: 'Could not initiate payment. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /tickets/order/cart/:cartId
// Returns all orders + tickets for a cart (used by the success page).
// Polls-friendly: returns 404 until all orders have been created by the webhook.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/order/cart/:cartId', async (req, res) => {
  try {
    const reservations = await TicketReservation.find({ cartId: req.params.cartId });
    if (!reservations.length) {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }

    const reservationIds = reservations.map((r) => r._id);
    const orders = await Order.find({
      reservationId: { $in: reservationIds },
      paymentStatus: 'paid',
    })
      .populate('gameId',      'description venue gameDate eventEndDate')
      .populate('ticketTypeId', 'name price scope');

    if (!orders.length) {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }

    const orderIds   = orders.map((o) => o._id);
    const allTickets = await Ticket.find({ orderId: { $in: orderIds } }).sort({ createdAt: 1 });

    const ticketsByOrder = new Map();
    for (const t of allTickets) {
      const key = t.orderId.toString();
      if (!ticketsByOrder.has(key)) ticketsByOrder.set(key, []);
      ticketsByOrder.get(key).push(t);
    }

    const grandTotal = orders.reduce((sum, o) => sum + o.totalAmount, 0);

    return res.json({
      success: true,
      data: {
        game:       orders[0].gameId,
        buyer:      { name: orders[0].buyerName, email: orders[0].buyerEmail },
        grandTotal,
        orders: orders.map((o) => ({
          orderNumber:      o.orderNumber,
          ticketTypeName:   o.ticketTypeId.name,
          ticketTypeScope:  o.ticketTypeId.scope,
          quantity:         o.quantity,
          totalAmount:      o.totalAmount,
          tickets:          ticketsByOrder.get(o._id.toString()) ?? [],
        })),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
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
