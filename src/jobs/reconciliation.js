const cron = require('node-cron');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const TicketType = require('../models/TicketType');
const TicketReservation = require('../models/TicketReservation');
const Game = require('../models/Game');
const PendingCheckout = require('../models/PendingCheckout');
const { getPaymentStatus } = require('../services/paymongo');
const { generateTickets } = require('../utils/generateTickets');
const { sendTicketEmail, sendTransactionNotification } = require('../services/mailer');
const { sendTicketSMS } = require('../services/sms');
const { generateOrderNumber } = require('../utils/orderNumber');

// ── Constants ──────────────────────────────────────────────────────────────────

// Only reconcile checkouts that are at least this old (give webhook time to fire)
const MIN_AGE_MS = 15 * 60 * 1000;  // 15 minutes

// Stop trying after this long (PayMongo sessions expire, no point retrying)
const MAX_AGE_MS = 24 * 60 * 60 * 1000;  // 24 hours

// ── Core reconciliation logic for one cart ────────────────────────────────────

async function reconcileCart(pending) {
  const { cartId, checkoutId } = pending;

  // ── Idempotency: check if already fully processed ─────────────────────────
  const reservationIds = pending.items.map((i) => i.reservationId);
  const existingOrders = await Order.find({
    reservationId: { $in: reservationIds },
    paymentStatus: 'paid',
  });

  if (existingOrders.length === pending.items.length) {
    // Webhook already handled it — just update our record
    await PendingCheckout.findByIdAndUpdate(pending._id, {
      status: 'processed',
      processedAt: new Date(),
    });
    console.log(`[reconciliation] Cart ${cartId} already fully processed — marking done.`);
    return;
  }

  // ── Verify payment status with PayMongo ───────────────────────────────────
  let payment;
  try {
    payment = await getPaymentStatus(checkoutId);
  } catch (err) {
    console.error(`[reconciliation] PayMongo verify failed for cart ${cartId}:`, err.message);
    return; // Leave as pending — try again next cycle
  }

  if (payment.status === 'PAYMENT_EXPIRED') {
    await PendingCheckout.findByIdAndUpdate(pending._id, { status: 'failed' });
    await TicketReservation.updateMany({ cartId }, { $set: { status: 'expired' } });
    console.log(`[reconciliation] Cart ${cartId} expired — marked failed.`);
    return;
  }

  if (payment.status !== 'PAYMENT_SUCCESS') {
    console.log(`[reconciliation] Cart ${cartId} not yet paid (${payment.status}) — skipping.`);
    return;
  }

  // ── Payment confirmed — process the cart ──────────────────────────────────
  console.log(`[reconciliation] Cart ${cartId} paid but unprocessed — recovering…`);

  // Claim any live reservations that are still around (no-op if already deleted)
  await TicketReservation.updateMany(
    { cartId, status: 'reserved' },
    { $set: { status: 'completed' } }
  ).catch(() => {});

  const game = await Game.findById(pending.gameId);
  const allTickets = [];
  const createdOrders = [];
  let firstOrder;

  for (const item of pending.items) {
    const { reservationId, ticketTypeId, quantity } = item;

    // Per-item idempotency — skip if this order was already created
    const alreadyDone = await Order.findOne({ reservationId, paymentStatus: 'paid' });
    if (alreadyDone) {
      const existingTickets = await Ticket.find({ orderId: alreadyDone._id });
      const tt = await TicketType.findById(ticketTypeId);
      for (const t of existingTickets) {
        allTickets.push({
          ...t.toObject(),
          ticketTypeName:  tt?.name  ?? 'Unknown',
          ticketTypeScope: tt?.scope ?? 'day',
          orderNumber:     alreadyDone.orderNumber,
        });
      }
      createdOrders.push(alreadyDone);
      if (!firstOrder) firstOrder = alreadyDone;
      continue;
    }

    const ticketType  = await TicketType.findById(ticketTypeId);
    if (!ticketType) {
      console.error(`[reconciliation] TicketType ${ticketTypeId} not found — skipping item.`);
      continue;
    }

    const totalAmount = (ticketType.price + (ticketType.serviceFee ?? 0)) * quantity;

    let order;
    try {
      order = await Order.create({
        orderNumber:      generateOrderNumber(),
        gameId:           pending.gameId,
        ticketTypeId,
        reservationId,
        buyerEmail:       pending.buyerEmail,
        buyerPhone:       pending.buyerPhone,
        buyerName:        pending.buyerName,
        country:          pending.country ?? null,
        quantity,
        totalAmount,
        paymentStatus:    'paid',
        paymentReference: payment.id ?? checkoutId,
      });
    } catch (err) {
      console.error(`[reconciliation] Order.create failed for reservation ${reservationId}:`, err.message);
      continue;
    }

    if (!firstOrder) firstOrder = order;
    createdOrders.push(order);

    await TicketType.findByIdAndUpdate(ticketTypeId, { $inc: { sold: quantity } });

    const totalTickets = quantity * (ticketType.ticketsPerPurchase ?? 1);
    let tickets;
    try {
      tickets = await generateTickets({
        orderId:      order._id,
        gameId:       pending.gameId,
        ticketTypeId,
        quantity:     totalTickets,
      });
    } catch (err) {
      console.error(`[reconciliation] generateTickets failed for order ${order._id}:`, err.message);
      continue;
    }

    for (const t of tickets) {
      allTickets.push({
        ...t.toObject(),
        ticketTypeName:  ticketType.name,
        ticketTypeScope: ticketType.scope,
        orderNumber:     order.orderNumber,
      });
    }
  }

  if (!firstOrder) {
    console.error(`[reconciliation] No orders created for cart ${cartId} — check logs above.`);
    return;
  }

  const grandTotal = createdOrders.reduce((s, o) => s + o.totalAmount, 0);

  // Send buyer email + SMS
  sendTicketEmail({
    to:        pending.buyerEmail,
    buyerName: pending.buyerName,
    game,
    grandTotal,
    allTickets,
  }).catch((err) => console.error('[reconciliation] Email failed:', err.message));

  sendTicketSMS({
    phone:       pending.buyerPhone,
    buyerName:   pending.buyerName,
    orderNumber: firstOrder.orderNumber,
    game,
  }).catch((err) => console.error('[reconciliation] SMS failed:', err.message));

  sendTransactionNotification({
    game,
    buyerName:  pending.buyerName,
    buyerEmail: pending.buyerEmail,
    grandTotal,
    allTickets,
  }).catch((err) => console.error('[reconciliation] Transaction notification failed:', err.message));

  await PendingCheckout.findByIdAndUpdate(pending._id, {
    status: 'processed',
    processedAt: new Date(),
  });

  console.log(
    `[reconciliation] Recovered cart ${cartId} — ` +
    `${createdOrders.length} order(s), ₱${grandTotal.toLocaleString()} → ${pending.buyerEmail}`
  );
}

// ── Run one reconciliation pass ────────────────────────────────────────────────

async function runReconciliation() {
  const now     = Date.now();
  const minAge  = new Date(now - MIN_AGE_MS);
  const maxAge  = new Date(now - MAX_AGE_MS);

  // Find checkouts that are old enough to have missed a webhook,
  // but not so old that PayMongo has long since expired them
  const pending = await PendingCheckout.find({
    status:    'pending',
    createdAt: { $lte: minAge, $gte: maxAge },
  });

  if (!pending.length) return;

  console.log(`[reconciliation] Found ${pending.length} unprocessed checkout(s) — checking…`);

  for (const p of pending) {
    try {
      await reconcileCart(p);
    } catch (err) {
      console.error(`[reconciliation] Unexpected error for cart ${p.cartId}:`, err.message);
    }
  }
}

// ── Schedule ───────────────────────────────────────────────────────────────────

function scheduleReconciliation() {
  // Every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    runReconciliation().catch((err) =>
      console.error('[reconciliation] Run failed:', err.message)
    );
  });

  console.log('[reconciliation] Scheduled: every 15 minutes');
}

module.exports = { scheduleReconciliation };
