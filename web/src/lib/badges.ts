import type { BadgeType, TicketType } from '@/types';

/**
 * Returns the single most-urgent badge for one ticket type.
 *
 * Availability-ratio badges use `available` (quantity − sold − reserved) so
 * seats held by active reservations are treated as unavailable.
 * "Trending" is based solely on how many tickets have been sold.
 *
 * Priority: Last Chance > Almost Sold Out > Fast Selling > Trending
 *
 * @param available  Server-computed available seats (quantity − sold − reserved)
 * @param quantity   Total seat capacity
 * @param sold       Confirmed sold tickets (excludes active reservations)
 */
export function getBadge(available: number, quantity: number, sold: number): BadgeType | null {
  if (quantity === 0) return null;
  const pct = available / quantity; // fraction of total capacity still available
  if (pct <= 0.25) return 'last-chance';
  if (pct <= 0.50) return 'almost-sold-out';
  if (pct <= 0.75) return 'fast-selling';
  if (sold >= 10)  return 'trending';
  return null;
}

/**
 * Returns the most-urgent badge across all ticket types of a game.
 * Used on the game-listing card where we show one representative badge.
 */
export function getGameBadge(ticketTypes: TicketType[]): BadgeType | null {
  const order: BadgeType[] = ['last-chance', 'almost-sold-out', 'fast-selling', 'trending'];
  const badges = new Set(ticketTypes.map((t) => getBadge(t.available, t.quantity, t.sold)));
  return order.find((b) => badges.has(b)) ?? null;
}
