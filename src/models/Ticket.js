const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketId: { type: String, required: true, unique: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
  ticketTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'TicketType', required: true },
  qrCodeUrl: { type: String, default: null },
  status: { type: String, enum: ['unused', 'used'], default: 'unused' },
  createdAt: { type: Date, default: Date.now },
});

ticketSchema.index({ orderId: 1 });
ticketSchema.index({ gameId: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);
