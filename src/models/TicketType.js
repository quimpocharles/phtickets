const mongoose = require('mongoose');

// Mongoose appends __v (versionKey) to every document automatically.
// It is used here for optimistic concurrency control on admin edits:
// PATCH /admin/games/:gameId/tickets/:ticketTypeId requires the client
// to supply the current __v; the update is rejected if the version has
// changed since the client last fetched the document.
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

ticketTypeSchema.index({ gameId: 1 });

module.exports = mongoose.model('TicketType', ticketTypeSchema);
