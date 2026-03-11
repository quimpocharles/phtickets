import { getGames } from '@/lib/api';
import GameCard from '@/components/GameCard';

export const revalidate = 60;

export default async function TicketsPage() {
  let games;
  try {
    games = await getGames();
  } catch {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <p className="text-offblack/40 text-sm">Could not load games. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pt-24 pb-10">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-3xl font-black uppercase tracking-tight text-offblack leading-none">
          Upcoming <span className="text-primary">Games</span>
        </h1>
        <p className="text-offblack/50 mt-2 text-sm">
          {games.length} game{games.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {games.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 py-20 text-center">
          <p className="text-offblack/40 font-medium">No upcoming games yet.</p>
          <p className="text-offblack/25 text-sm mt-1">Check back soon.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5 max-w-2xl">
          {games.map((game) => (
            <GameCard key={game._id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}
