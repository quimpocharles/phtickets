const mongoose = require('mongoose');

/**
 * Durable record of every PayMongo checkout attempt.
 * Survives TicketReservation TTL expiry — used by the reconciliation cron
 * to detect and recover from missed webhook deliveries.
 */
const PendingCheckoutSchema = new mongoose.Schema(
  {
    cartId:     { type: String, required: true, unique: true },
    checkoutId: { type: String, required: true },
    buyerEmail: { type: String, required: true },
    buyerPhone: { type: String, required: true },
    buyerName:  { type: String, default: null },
    country:    { type: String, default: null },
    gameId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },

    // Each item pairs a reservation _id with its ticket type + quantity.
    // Stored so the reconciliation can rebuild Orders if the TicketReservation
    // documents have already been deleted by MongoDB's TTL index.
    items: [
      {
        reservationId: { type: mongoose.Schema.Types.ObjectId },
        ticketTypeId:  { type: mongoose.Schema.Types.ObjectId },
        quantity:      { type: Number },
      },
    ],

    status:      { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Index to let the reconciliation cron query efficiently
PendingCheckoutSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('PendingCheckout', PendingCheckoutSchema);
