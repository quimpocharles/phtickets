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
      href={`/passes/${game._id}`}
      className="group block rounded-2xl overflow-hidden shadow-sm border border-black/5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* ── Mobile: vertical poster card ── */}
      <div className="sm:hidden">
        {/* Details above image */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-black uppercase tracking-tight leading-snug text-offblack flex-1">
              {game.description}
            </h2>
            <div className="text-right shrink-0 mt-1">
              <p className="text-xs font-semibold text-offblack/50">{dateStr}</p>
              <p className="text-xs text-offblack/40">{timeStr}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <svg className="w-3.5 h-3.5 text-offblack/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm text-offblack/50">{game.venue}</p>
          </div>
        </div>

        {/* Portrait image */}
        <div className="relative bg-black mx-3 mb-3 rounded-xl overflow-hidden" style={{ aspectRatio: '3/4' }}>
          <Image
            src="/smart-gh.jpg"
            alt="Smart Global Hoops 2026"
            fill
            className="object-contain group-hover:scale-105 transition-transform duration-300"
          />
          {badge && (
            <div className="absolute top-3 left-3 z-10">
              <Badge type={badge} size="sm" />
            </div>
          )}
          {/* CTA at bottom */}
          <div className="absolute inset-x-0 bottom-0 p-3 z-10 flex items-center justify-between">
            {lowestPrice !== null && (
              <span className="bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                From ₱{lowestPrice.toLocaleString()}
              </span>
            )}
            <span className="bg-yellow-400 text-black text-xs font-bold px-3 py-1.5 rounded-lg ml-auto">
              Get Passes →
            </span>
          </div>
        </div>
      </div>

      {/* ── Desktop: horizontal card ── */}
      <div className="hidden sm:flex flex-row bg-white">
        <div className="relative shrink-0 bg-black overflow-hidden" style={{ width: 150 }}>
          <Image
            src="/smart-gh.jpg"
            alt="Smart Global Hoops 2026"
            fill
            className="object-contain group-hover:scale-105 transition-transform duration-300"
          />
          {badge && (
            <div className="absolute top-2 left-2 z-10">
              <Badge type={badge} size="sm" />
            </div>
          )}
        </div>

        <div className="flex flex-col flex-1 min-w-0 p-4 gap-3">
          <div>
            <p className="text-xs font-semibold text-primary/60 uppercase tracking-widest mb-0.5">
              {dateStr} · {timeStr}
            </p>
            <h2 className="text-base font-black uppercase tracking-tight leading-snug text-offblack">
              {game.description}
            </h2>
            <p className="text-sm text-offblack/50 mt-0.5">{game.venue}</p>
          </div>

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

          <div className="flex items-center justify-between pt-1 border-t border-black/5">
            {lowestPrice !== null ? (
              <p className="text-sm text-offblack/60">
                From <span className="font-bold text-offblack">₱{lowestPrice.toLocaleString()}</span>
              </p>
            ) : (
              <p className="text-sm text-offblack/40">No passes listed</p>
            )}
            <span className="text-xs font-bold text-primary group-hover:underline">
              Get Passes →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
