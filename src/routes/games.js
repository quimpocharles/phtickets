const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const TicketType = require('../models/TicketType');
const TicketReservation = require('../models/TicketReservation');
const { uploadBanner } = require('../services/cloudinary');

/**
 * Computes the urgency badge for a ticket type.
 * remaining / quantity ratio takes priority over sold count.
 *
 * @param {number} quantity
 * @param {number} sold
 * @returns {string|null}
 */
function getUrgencyBadge(quantity, sold) {
  if (quantity === 0) return null;
  const remaining = quantity - sold;
  const pct = remaining / quantity;
  if (pct <= 0.25) return 'Last Chance to Buy';
  if (pct <= 0.50) return 'Almost Sold-Out';
  if (pct <= 0.75) return 'Fast-Selling';
  if (sold >= 10)  return 'Trending';
  return null;
}

// GET /games
// Returns upcoming games with ticket types.  Each ticket type includes:
//   available = quantity - sold - reservedTickets
// where reservedTickets is the sum of quantities from active reservations
// (status = "reserved" AND expiresAt > now).
router.get('/', async (req, res) => {
  try {
    const games = await Game.find({ gameDate: { $gte: new Date() } })
      .sort({ gameDate: 1 });

    if (games.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Load all ticket types for every game in one query (avoids N+1)
    const gameIds = games.map((g) => g._id);
    const allTicketTypes = await TicketType.find({ gameId: { $in: gameIds }, active: { $ne: false } });

    // Single aggregate: get active reservation totals for every ticket type at once
    const ticketTypeIds = allTicketTypes.map((t) => t._id);
    const reservedMap = await TicketReservation.getReservedCountMap(ticketTypeIds);

    // Annotate each ticket type with availability
    // available = ticketType.quantity - ticketType.sold - reservedTickets
    const annotatedById = new Map(
      allTicketTypes.map((tt) => {
        const reserved        = reservedMap.get(tt._id.toString()) ?? 0;
        const available       = Math.max(0, tt.quantity - tt.sold - reserved);
        const urgencyBadge    = getUrgencyBadge(tt.quantity, tt.sold);
        const remainingTickets = tt.quantity - tt.sold;
        const scarcityMessage = remainingTickets < 100
          ? `Only ${remainingTickets} tickets left`
          : null;
        return [
          tt._id.toString(),
          { ...tt.toObject(), reserved, available, urgencyBadge, scarcityMessage },
        ];
      })
    );

    // Group annotated ticket types by gameId
    const ticketTypesByGame = new Map();
    for (const [, tt] of annotatedById) {
      const key = tt.gameId.toString();
      if (!ticketTypesByGame.has(key)) ticketTypesByGame.set(key, []);
      ticketTypesByGame.get(key).push(tt);
    }

    const result = games.map((game) => ({
      ...game.toObject(),
      ticketTypes: ticketTypesByGame.get(game._id.toString()) ?? [],
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[games]', err);
    res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

module.exports = router;
