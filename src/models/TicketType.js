const mongoose = require('mongoose');

const ticketTypeSchema = new mongoose.Schema({
  gameId:             { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
  name:               { type: String, required: true },
  price:              { type: Number, required: true },
  quantity:           { type: Number, required: true },
  sold:               { type: Number, default: 0 },
  // 'day'  → valid for one day only (marked used on first scan; bouncer stamps hand)
  // 'all'  → valid for every event day (checked via ScanLog, never marked used)
  scope:              { type: String, enum: ['day', 'all'], default: 'day' },
  // Number of individual QR codes generated per purchase unit.
  // Set to 5 for family passes, 1 for individual passes.
  ticketsPerPurchase: { type: Number, default: 1, min: 1 },
});

module.exports = mongoose.model('TicketType', ticketTypeSchema);
