const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
  ticketTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'TicketType', required: true },
  buyerEmail: { type: String, required: true },
  buyerPhone: { type: String, required: true },
  buyerName: { type: String, default: null },
  quantity: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },
  paymentReference: { type: String, default: null },
  // Links back to the TicketReservation that originated this order.
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'TicketReservation', default: null },
  createdAt: { type: Date, default: Date.now },
});

orderSchema.index({ reservationId: 1 });
orderSchema.index({ gameId: 1 });
orderSchema.index({ buyerEmail: 1, buyerPhone: 1 });

module.exports = mongoose.model('Order', orderSchema);
