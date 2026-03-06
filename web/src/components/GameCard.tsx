import Image from 'next/image';
import Link from 'next/link';
import type { Game } from '@/types';
import Badge from './Badge';
import { getGameBadge } from '@/lib/badges';

interface Props {
  game: Game;
}

export default function GameCard({ game }: Props) {
  const badge = getGameBadge(game.ticketTypes);
  const lowestPrice = game.ticketTypes.length
    ? Math.min(...game.ticketTypes.map((t) => t.price))
    : null;

  const startDate = new Date(game.gameDate);
  const TZ = 'Asia/Manila';
  const endDate   = new Date(game.eventEndDate);
  const dayKey    = (d: Date) => d.toLocaleDateString('en-PH', { timeZone: TZ });
  const isSameDay = dayKey(startDate) === dayKey(endDate);

  const dateStr = isSameDay
    ? startDate.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: TZ })
    : `${startDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: TZ })}–${endDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: TZ })}`;

  const timeStr = startDate.toLocaleTimeString('en-PH', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ,
  });

  return (
    <Link
      href={`/tickets/${game._id}`}
      className="group flex flex-col rounded-2xl overflow-hidden bg-white shadow-sm border border-black/5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Banner */}
      <div className="relative h-36 w-full bg-primary overflow-hidden">
        {game.bannerImage ? (
          <Image
            src={game.bannerImage}
            alt={game.description}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          /* Stylised placeholder when no banner is uploaded */
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <span className="text-white text-sm font-black uppercase tracking-tight leading-tight text-center">
              {game.description}
            </span>
          </div>
        )}

        {/* Badge overlay */}
        {badge && (
          <div className="absolute top-2.5 left-2.5">
            <Badge type={badge} size="sm" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Teams */}
        <div>
          <p className="text-xs font-semibold text-primary/60 uppercase tracking-widest mb-0.5">
            {dateStr} · {timeStr}
          </p>
          <h2 className="text-base font-black uppercase tracking-tight leading-snug text-offblack">
            {game.description}
          </h2>
          <p className="text-sm text-offblack/50 mt-0.5">{game.venue}</p>
        </div>

        {/* Ticket types row */}
        {game.ticketTypes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
            {game.ticketTypes.map((tt) => (
              <span
                key={tt._id}
                className="text-[11px] font-medium border border-black/10 rounded-md px-2 py-0.5 text-offblack/70"
              >
                {tt.name}
                {tt.available === 0 && (
                  <span className="ml-1 text-danger font-semibold">· Sold out</span>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-black/5">
          {lowestPrice !== null ? (
            <p className="text-sm text-offblack/60">
              From{' '}
              <span className="font-bold text-offblack">
                ₱{lowestPrice.toLocaleString()}
              </span>
            </p>
          ) : (
            <p className="text-sm text-offblack/40">No tickets listed</p>
          )}
          <span className="text-xs font-bold text-primary group-hover:underline">
            Get Tickets →
          </span>
        </div>
      </div>
    </Link>
  );
}
