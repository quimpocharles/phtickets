export interface TicketType {
  _id: string;
  gameId: string;
  name: string;
  price: number;
  quantity: number;
  sold: number;
  scope: 'day' | 'all';
  ticketsPerPurchase: number;
  /** Tickets currently held by active reservations (status=reserved, not expired). */
  reserved: number;
  /** Server-computed: quantity - sold - reserved. Use this for all availability display. */
  available: number;
  /** Server-computed urgency label based on quantity - sold ratio and sold count. */
  urgencyBadge: 'Trending' | 'Fast-Selling' | 'Almost Sold-Out' | 'Last Chance to Buy' | null;
  /** "Only N tickets left" when quantity - sold < 100, otherwise null. */
  scarcityMessage: string | null;
}

export interface Game {
  _id: string;
  description: string;
  venue: string;
  gameDate: string;
  eventEndDate: string;
  bannerImage: string | null;
  createdAt: string;
  ticketTypes: TicketType[];
}

export interface PurchasePayload {
  ticketTypeId: string;
  quantity: number;
  buyerEmail: string;
  buyerPhone: string;
  buyerName?: string;
  country?: string;
}

export interface PurchaseResponse {
  success: boolean;
  data: {
    reservationId: string;
    expiresAt: string;
    checkoutId: string;
    checkoutUrl: string;
  };
  message?: string;
}

export type BadgeType = 'trending' | 'fast-selling' | 'almost-sold-out' | 'last-chance';
