const mongoose = require('mongoose');

// How long the seat hold lasts before checkout is initiated
const RESERVATION_TTL_SECONDS = 5 * 60;        // 5 minutes

// How long a reservation lives once a Maya checkout session exists.
// Must exceed Maya's checkout session timeout so the webhook can still
// find the document after the user completes payment.
const CHECKOUT_WINDOW_SECONDS = 30 * 60;        // 30 minutes

const ticketReservationSchema = new mongoose.Schema({
  gameId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Game',       required: true },
  ticketTypeId:{ type: mongoose.Schema.Types.ObjectId, ref: 'TicketType', required: true },
  quantity:    { type: Number, required: true, min: 1 },
  buyerEmail:  { type: String, required: true },
  buyerPhone:  { type: String, required: true },
  buyerName:   { type: String, default: null },
  status: {
    type: String,
    enum: ['reserved', 'completed', 'expired'],
    default: 'reserved',
  },
  // Set at reservation creation.  Extended to +30 min after a Maya checkout is
  // created so the TTL index does not delete the document before the webhook fires.
  expiresAt:  { type: Date, required: true },
  // Populated after createCheckout() succeeds; used by the webhook to cross-verify.
  checkoutId: { type: String, default: null },
  createdAt:  { type: Date, default: Date.now },
});

// ── Indexes ──────────────────────────────────────────────────────────────────

// TTL index: MongoDB deletes the document when expiresAt is reached.
// expireAfterSeconds: 0 means "delete at exactly expiresAt, no extra delay".
ticketReservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Supports the active-reservation aggregate and claim query.
ticketReservationSchema.index({ ticketTypeId: 1, status: 1, expiresAt: 1 });

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the total quantity currently reserved (status=reserved, not expired)
 * for ONE ticketTypeId.  Runs inside the supplied session when provided.
 * Used inside transactions during reserve/purchase to prevent overselling.
 *
 * @param {mongoose.Types.ObjectId|string} ticketTypeId
 * @param {mongoose.ClientSession|null}    session
 * @returns {Promise<number>}
 */
ticketReservationSchema.statics.countActiveReserved = async function (ticketTypeId, session = null) {
  const pipeline = [
    {
      $match: {
        ticketTypeId: new mongoose.Types.ObjectId(String(ticketTypeId)),
        status:       'reserved',
        expiresAt:    { $gt: new Date() },
      },
    },
    { $group: { _id: null, total: { $sum: '$quantity' } } },
  ];

  const agg = this.aggregate(pipeline);
  if (session) agg.session(session);
  const result = await agg;
  return result[0]?.total ?? 0;
};

/**
 * Returns a Map of ticketTypeId (string) → reserved quantity for all given IDs.
 * Runs a single aggregate across all IDs so GET /games pays one DB round-trip
 * rather than one per ticket type.
 *
 * @param {Array<mongoose.Types.ObjectId|string>} ticketTypeIds
 * @returns {Promise<Map<string, number>>}
 */
ticketReservationSchema.statics.getReservedCountMap = async function (ticketTypeIds) {
  if (!ticketTypeIds.length) return new Map();

  const result = await this.aggregate([
    {
      $match: {
        ticketTypeId: { $in: ticketTypeIds.map((id) => new mongoose.Types.ObjectId(String(id))) },
        status:       'reserved',
        expiresAt:    { $gt: new Date() },
      },
    },
    { $group: { _id: '$ticketTypeId', total: { $sum: '$quantity' } } },
  ]);

  return new Map(result.map((r) => [r._id.toString(), r.total]));
};

module.exports = mongoose.model('TicketReservation', ticketReservationSchema);
module.exports.RESERVATION_TTL_SECONDS  = RESERVATION_TTL_SECONDS;
module.exports.CHECKOUT_WINDOW_SECONDS  = CHECKOUT_WINDOW_SECONDS;
