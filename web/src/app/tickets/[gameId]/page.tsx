import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getGame, getGames } from '@/lib/api';
import TicketPurchasePanel from '@/components/TicketPurchasePanel';

export const revalidate = 60;

// Pre-build known game pages at build time
export async function generateStaticParams() {
  try {
    const games = await getGames();
    return games.map((g) => ({ gameId: g._id }));
  } catch {
    return [];
  }
}

interface Props {
  params: { gameId: string };
}

export default async function GameDetailPage({ params }: Props) {
  const game = await getGame(params.gameId);
  if (!game) notFound();

  const gameDate = new Date(game.gameDate);
  const dateStr = gameDate.toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr = gameDate.toLocaleTimeString('en-PH', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  return (
    <div>
      {/* ── Banner ── */}
      <div className="relative h-52 sm:h-64 w-full bg-primary overflow-hidden">
        {game.bannerImage ? (
          <Image
            src={game.bannerImage}
            alt={game.description}
            fill
            priority
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8">
            {/* diagonal accent stripe */}
            <div className="absolute inset-0 opacity-10"
              style={{ background: 'repeating-linear-gradient(45deg, #fed000 0, #fed000 2px, transparent 0, transparent 50%)' , backgroundSize: '20px 20px' }}
            />
            <span className="text-white text-2xl sm:text-4xl font-black uppercase tracking-tight leading-tight drop-shadow-sm text-center">
              {game.description}
            </span>
          </div>
        )}

        {/* Dark gradient bottom for readability */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      {/* ── Game info bar ── */}
      <div className="bg-offblack text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          {/* Description */}
          <span className="font-black uppercase tracking-tight">
            {game.description}
          </span>

          <span className="text-white/40">·</span>

          {/* Date / time */}
          <span className="text-white/70">
            {dateStr}, {timeStr}
          </span>

          <span className="text-white/40">·</span>

          {/* Venue */}
          <span className="text-white/70">{game.venue}</span>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-offblack/40 mb-6">
          <Link href="/tickets" className="hover:text-primary transition-colors">
            Upcoming Games
          </Link>
          <span>/</span>
          <span className="text-offblack/70 font-medium">
            {game.description}
          </span>
        </nav>

        <TicketPurchasePanel game={game} />
      </div>
    </div>
  );
}
