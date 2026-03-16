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
  /** Web service fee per purchase unit charged on top of ticket price, shouldered by buyer. */
  serviceFee: number;
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

export interface CartItem {
  ticketTypeId: string;
  quantity: number;
}

export interface PurchasePayload {
  items: CartItem[];
  buyerEmail: string;
  buyerPhone: string;
  buyerName?: string;
  country?: string;
  paymentMethod?: 'paymongo' | 'paypal';
}

export interface PurchaseResponse {
  success: boolean;
  data: {
    cartId: string;
    expiresAt: string;
    // PayMongo
    checkoutId?: string;
    checkoutUrl?: string;
    // PayPal
    paypalOrderId?: string;
    approvalUrl?: string;
    paypalProcessingFee?: number;
  };
  message?: string;
}

export interface CartOrderResponse {
  success: boolean;
  data: {
    game: { description: string; venue: string; gameDate: string; eventEndDate: string };
    buyer: { name: string | null; email: string };
    grandTotal: number;
    orders: Array<{
      orderNumber: string;
      ticketTypeName: string;
      ticketTypeScope: string;
      quantity: number;
      totalAmount: number;
      tickets: Array<{ _id: string; ticketId: string; qrCodeUrl: string; status: string }>;
    }>;
  };
  message?: string;
}

export type BadgeType = 'trending' | 'fast-selling' | 'almost-sold-out' | 'last-chance';
