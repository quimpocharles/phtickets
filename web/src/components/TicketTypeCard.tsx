'use client';

import type { TicketType } from '@/types';

const URGENCY_CONFIG = {
  'Trending':           { emoji: '🔥', label: 'Trending',           className: 'bg-accent text-offblack' },
  'Fast-Selling':       { emoji: '⚡', label: 'Fast-Selling',       className: 'bg-primary text-white' },
  'Almost Sold-Out':    { emoji: '🚨', label: 'Almost Sold-Out',    className: 'bg-offblack text-white' },
  'Last Chance to Buy': { emoji: '🔴', label: 'Last Chance to Buy', className: 'bg-danger text-white animate-pulse-badge' },
} as const;

interface Props {
  ticketType: TicketType;
  selected: boolean;
  onClick: () => void;
}

export default function TicketTypeCard({ ticketType, selected, onClick }: Props) {
  const soldOut = ticketType.available <= 0;
  const urgency = ticketType.urgencyBadge ? URGENCY_CONFIG[ticketType.urgencyBadge] : null;

  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 p-4 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
        ${soldOut
          ? 'opacity-50 cursor-not-allowed border-black/10 bg-white'
          : selected
            ? 'border-primary bg-primary/5 shadow-md'
            : 'border-black/10 bg-white hover:border-primary/40 hover:shadow-sm'
        }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className={`font-bold text-base ${selected ? 'text-primary' : 'text-offblack'}`}>
            {ticketType.name}
          </p>

          {/* Urgency badge — above price, hidden when sold out */}
          {!soldOut && urgency && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide rounded-full px-2.5 py-0.5 mt-1.5 ${urgency.className}`}
            >
              {urgency.emoji} {urgency.label}
            </span>
          )}

          <p className="text-xl font-black text-offblack mt-1.5">
            ₱{ticketType.price.toLocaleString()}
            <span className="text-sm font-normal text-offblack/50 ml-1">/ ticket</span>
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {soldOut && (
            <span className="text-xs font-bold text-danger uppercase tracking-wide">Sold Out</span>
          )}
          {selected && !soldOut && (
            <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
        </div>
      </div>

    </button>
  );
}
