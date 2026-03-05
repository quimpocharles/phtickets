'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface GameSummary {
  _id: string;
  description: string;
  venue: string;
  gameDate: string;
  eventEndDate: string;
  ticketsSold: number;
  ticketsRemaining: number;
}

export default function GateReconciliationIndexPage() {
  const router = useRouter();
  const [games, setGames]     = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

  const fetchGames = useCallback(async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) { router.replace('/admin/login'); return; }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/admin/games`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem('adminToken');
        router.replace('/admin/login');
        return;
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setGames(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load games.');
    } finally {
      setLoading(false);
    }
  }, [API_URL, router]);

  useEffect(() => { fetchGames(); }, [fetchGames]);

  const now       = new Date();
  const past      = games.filter((g) => new Date(g.eventEndDate) < now).reverse();
  const upcoming  = games.filter((g) => new Date(g.eventEndDate) >= now);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">

      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-widest text-offblack/40 mb-1">Reports</p>
        <h1 className="text-2xl font-black text-offblack">Gate Reconciliation</h1>
        <p className="text-sm text-offblack/40 mt-1">
          Select a game to view its scan report.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-danger font-semibold mb-2">Failed to load games</p>
          <p className="text-sm text-offblack/50 mb-4">{error}</p>
          <button onClick={fetchGames} className="text-primary text-sm font-bold hover:underline">
            Try again
          </button>
        </div>
      ) : games.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm px-6 py-16 text-center">
          <p className="text-offblack/40 text-sm">No games found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-7">
          {past.length > 0 && (
            <GameList title="Past Games" games={past} past />
          )}
          {upcoming.length > 0 && (
            <GameList title="Upcoming Games" games={upcoming} />
          )}
        </div>
      )}
    </div>
  );
}

function GameList({ title, games, past }: { title: string; games: GameSummary[]; past?: boolean }) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-widest text-offblack/40 mb-3">{title}</h2>
      <div className="bg-white rounded-2xl border border-black/8 shadow-sm overflow-hidden divide-y divide-black/5">
        {games.map((game) => {
          const start = new Date(game.gameDate);
          const end   = new Date(game.eventEndDate);
          const isSameDay = start.toDateString() === end.toDateString();
          const total = game.ticketsSold + game.ticketsRemaining;
          const pct   = total > 0 ? game.ticketsSold / total : 0;

          return (
            <a
              key={game._id}
              href={`/admin/reports/gate/${game._id}`}
              className="flex items-center gap-4 px-6 py-4 hover:bg-offwhite/60 transition-colors group"
            >
              {/* Date badge */}
              <div className={`w-12 text-center shrink-0 rounded-xl py-1.5 ${past ? 'bg-offwhite' : 'bg-primary/8'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wide ${past ? 'text-offblack/30' : 'text-primary/70'}`}>
                  {start.toLocaleDateString('en-PH', { month: 'short' })}
                </p>
                <p className={`text-lg font-black leading-tight ${past ? 'text-offblack/40' : 'text-primary'}`}>
                  {isSameDay ? start.getDate() : `${start.getDate()}–${end.getDate()}`}
                </p>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-offblack text-sm">
                  {game.description}
                </p>
                <p className="text-xs text-offblack/40 truncate mt-0.5">{game.venue}</p>
              </div>

              {/* Sold pill */}
              <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                <span className="text-xs font-semibold text-offblack">
                  {game.ticketsSold.toLocaleString()} sold
                </span>
                {total > 0 && (
                  <div className="w-20 h-1 bg-black/8 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 0.75 ? 'bg-danger' : pct >= 0.5 ? 'bg-accent' : 'bg-primary'}`}
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Arrow */}
              <svg
                className="w-4 h-4 text-offblack/20 group-hover:text-primary transition-colors shrink-0"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </a>
          );
        })}
      </div>
    </div>
  );
}
