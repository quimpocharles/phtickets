'use client';

import type { TicketType } from '@/types';

// Starburst clip-path: 14-spike star (28 vertices, computed from alternating
// outer-radius=50% and inner-radius=40% at 25.7° intervals starting from top)
const STARBURST_PATH =
  'polygon(50% 0%, 59% 11%, 72% 5%, 75% 19%, 89% 19%, 86% 33%, 99% 39%, 90% 50%, 99% 61%, 86% 67%, 89% 81%, 75% 81%, 72% 95%, 59% 89%, 50% 100%, 41% 89%, 28% 95%, 25% 81%, 11% 81%, 14% 67%, 1% 61%, 10% 50%, 1% 39%, 14% 33%, 11% 19%, 25% 19%, 28% 5%, 41% 11%)';

const STARBURST_CONFIG = {
  'Trending': {
    bg:    '#fed000',
    color: '#1a1a1a',
    lines: ['🔥'],
  },
  'Fast-Selling': {
    bg:    '#0133ae',
    color: '#ffffff',
    lines: ['FAST', 'SELLING'],
  },
  'Almost Sold-Out': {
    bg:    '#ff7a00',
    color: '#ffffff',
    lines: ['ALMOST', 'SOLD OUT'],
  },
  'Last Chance to Buy': {
    bg:    '#df0017',
    color: '#ffffff',
    lines: ['LAST', 'CHANCE'],
  },
} as const;

interface Props {
  ticketType: TicketType;
  cartQty: number;
  onAdd: () => void;
  onChangeQty: (qty: number) => void;
}

export default function TicketTypeCard({ ticketType, cartQty, onAdd, onChangeQty }: Props) {
  const soldOut = ticketType.available <= 0;
  const inCart  = cartQty > 0;
  const burst   = !soldOut && !inCart && ticketType.urgencyBadge
    ? STARBURST_CONFIG[ticketType.urgencyBadge]
    : null;
  const maxQty  = Math.min(ticketType.available, 25);

  const starburst = burst && (
    <span
      aria-hidden
      style={{
        position:        'absolute',
        top:             '-14px',
        right:           '-14px',
        width:           '76px',
        height:          '76px',
        backgroundColor: burst.bg,
        clipPath:        STARBURST_PATH,
        transform:       'rotate(12deg)',
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  'center',
        gap:             '1px',
        zIndex:          20,
        filter:          'drop-shadow(0 2px 6px rgba(0,0,0,0.35))',
        pointerEvents:   'none',
      }}
    >
      {burst.lines.map((line, i) => (
        <span
          key={i}
          style={{
            display:       'block',
            color:         burst.color,
            fontSize:      burst.lines.length === 1 ? '22px' : '8.5px',
            fontWeight:    900,
            letterSpacing: '0.04em',
            lineHeight:    1.15,
            textAlign:     'center',
            textTransform: 'uppercase',
            fontFamily:    'inherit',
          }}
        >
          {line}
        </span>
      ))}
    </span>
  );

  const cardContent = (
    <div className={soldOut ? 'opacity-75' : ''}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className={`font-bold text-base uppercase tracking-wide
            ${soldOut ? 'text-gray-400' : inCart ? 'text-white' : 'text-offblack'}`}>
            {ticketType.name}
          </p>
          <p className={`text-xl font-black mt-1.5
            ${soldOut ? 'text-gray-400' : inCart ? 'text-white' : 'text-offblack'}`}>
            ₱{ticketType.price.toLocaleString()}
            <span className={`text-sm font-normal ml-1
              ${soldOut ? 'text-gray-400' : inCart ? 'text-white/75' : 'text-offblack/50'}`}>
              / ticket
            </span>
          </p>
          {ticketType.serviceFee > 0 && (
            <p className={`text-xs mt-1 ${soldOut ? 'text-gray-400' : inCart ? 'text-white/50' : 'text-offblack/40'}`}>
              + ₱{ticketType.serviceFee.toLocaleString()} service fee
            </p>
          )}
          {!soldOut && ticketType.available < 15 && (
            <p className={`text-xs font-semibold mt-1.5 ${inCart ? 'text-white/80' : 'text-danger'}`}>
              Only {ticketType.available} left
            </p>
          )}
        </div>
        <div className="shrink-0">
          {soldOut && <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Sold Out</span>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="group/wrapper relative pb-3 pr-3">
      {/* depth layer */}
      <div
        aria-hidden
        className={`absolute top-3 left-3 bottom-0 right-0 rounded-xl bg-black transition-all duration-200
          ${!soldOut ? 'group-hover/wrapper:translate-x-[3px] group-hover/wrapper:translate-y-[3px]' : ''}`}
        style={soldOut ? { opacity: 0.4 } : undefined}
      />

      {starburst}

      {inCart ? (
        /* ── In-cart state: div + qty stepper ── */
        <div
          className="relative z-10 w-full rounded-xl border-2 border-black p-4 bg-offblack"
          style={{ borderLeftWidth: '6px', borderLeftColor: '#fed000' }}
        >
          {cardContent}
          {/* Qty stepper */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/15">
            <button
              type="button"
              onClick={() => onChangeQty(cartQty - 1)}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-lg flex items-center justify-center transition-colors"
            >
              {cartQty === 1 ? '×' : '−'}
            </button>
            <span className="text-white font-black text-lg w-6 text-center tabular-nums">{cartQty}</span>
            <button
              type="button"
              onClick={() => onChangeQty(cartQty + 1)}
              disabled={cartQty >= maxQty}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white font-bold text-lg flex items-center justify-center transition-colors"
            >
              +
            </button>
            <span className="text-white/40 text-xs ml-1">
              ₱{(ticketType.price * cartQty).toLocaleString()} subtotal
            </span>
          </div>
        </div>
      ) : (
        /* ── Default state: button ── */
        <button
          type="button"
          disabled={soldOut}
          onClick={onAdd}
          className={`group relative z-10 w-full text-left rounded-xl border-2 border-black p-4
            focus:outline-none focus-visible:ring-2
            ${soldOut
              ? 'cursor-not-allowed bg-[#f3f4f6] focus-visible:ring-black/20'
              : 'bg-white transition-all duration-200 hover:-translate-y-[3px] hover:shadow-lg focus-visible:ring-primary/40'
            }`}
        >
          {cardContent}
          {!soldOut && (
            <p className="text-xs text-offblack/40 mt-2 font-medium">Tap to add to cart</p>
          )}
        </button>
      )}
    </div>
  );
}
