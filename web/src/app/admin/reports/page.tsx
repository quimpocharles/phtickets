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
  totalRevenue: number;
}

export default function ReportsPage() {
  const router = useRouter();
  const [games, setGames]   = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-offwhite flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-offwhite flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-danger font-semibold mb-2">Failed to load reports</p>
          <p className="text-sm text-offblack/50 mb-4">{error}</p>
          <button onClick={fetchGames} className="text-primary text-sm font-bold hover:underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const now = new Date();
  const pastGames     = games.filter((g) => new Date(g.eventEndDate) < now).reverse();
  const upcomingGames = games.filter((g) => new Date(g.eventEndDate) >= now);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-offblack">Reports</h1>
          <p className="text-sm text-offblack/40 mt-1">
            Select a game to view its gate reconciliation report.
          </p>
        </div>

        {/* ── Report type cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          <ReportTypeCard
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            title="Gate Reconciliation"
            description="Tickets sold vs scanned, no-shows, and invalid scan attempts per game."
            active
          />
          <ReportTypeCard
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
            title="End of Day Report"
            description="Daily transaction summary emailed automatically at 11:59 PM PHT."
            note="Sent automatically via cron"
          />
        </div>

        {/* ── Game lists ── */}
        {games.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/8 shadow-sm px-6 py-16 text-center">
            <p className="text-offblack/40 text-sm">No games found.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {pastGames.length > 0 && (
              <GameSection
                title="Past Games"
                subtitle="Completed — reconciliation available"
                games={pastGames}
                past
              />
            )}
            {upcomingGames.length > 0 && (
              <GameSection
                title="Upcoming Games"
                subtitle="Reconciliation available once scanning begins"
                games={upcomingGames}
              />
            )}
          </div>
        )}
    </div>
  );
}

// ── Report type card ────────────────────────────────────────────────────────

function ReportTypeCard({ icon, title, description, active, note }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  active?: boolean;
  note?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 flex gap-4
      ${active ? 'border-primary/20' : 'border-black/8'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
        ${active ? 'bg-primary text-white' : 'bg-offwhite text-offblack/40'}`}>
        {icon}
      </div>
      <div>
        <p className="font-bold text-offblack text-sm">{title}</p>
        <p className="text-xs text-offblack/50 mt-0.5 leading-relaxed">{description}</p>
        {note && (
          <p className="text-[11px] text-offblack/30 mt-1.5 font-medium uppercase tracking-wide">{note}</p>
        )}
      </div>
    </div>
  );
}

// ── Game section ────────────────────────────────────────────────────────────

function GameSection({ title, subtitle, games, past }: {
  title: string;
  subtitle: string;
  games: GameSummary[];
  past?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="font-bold text-offblack">{title}</h2>
        <span className="text-xs text-offblack/40">{subtitle}</span>
      </div>

      <div className="bg-white rounded-2xl border border-black/8 shadow-sm overflow-hidden">
        <div className="divide-y divide-black/5">
          {games.map((game) => {
            const start = new Date(game.gameDate);
            const end   = new Date(game.eventEndDate);
            const isSameDay = start.toDateString() === end.toDateString();
            const total = game.ticketsSold + game.ticketsRemaining;
            const soldPct = total > 0 ? game.ticketsSold / total : 0;

            return (
              <a
                key={game._id}
                href={`/admin/reports/gate/${game._id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-offwhite/60 transition-colors group"
              >
                {/* Date badge */}
                <div className={`w-12 text-center shrink-0 rounded-xl py-1.5
                  ${past ? 'bg-offwhite' : 'bg-primary/8'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-wide
                    ${past ? 'text-offblack/30' : 'text-primary/70'}`}>
                    {start.toLocaleDateString('en-PH', { month: 'short' })}
                  </p>
                  <p className={`text-lg font-black leading-tight
                    ${past ? 'text-offblack/40' : 'text-primary'}`}>
                    {isSameDay
                      ? start.getDate()
                      : `${start.getDate()}–${end.getDate()}`}
                  </p>
                </div>

                {/* Game info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-offblack text-sm">
                    {game.description}
                  </p>
                  <p className="text-xs text-offblack/40 truncate mt-0.5">{game.venue}</p>
                </div>

                {/* Sales pill */}
                <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs font-semibold text-offblack">
                    {game.ticketsSold.toLocaleString()} sold
                  </span>
                  {total > 0 && (
                    <div className="w-20 h-1 bg-black/8 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${soldPct >= 0.75 ? 'bg-danger' : soldPct >= 0.5 ? 'bg-accent' : 'bg-primary'}`}
                        style={{ width: `${soldPct * 100}%` }}
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
    </div>
  );
}
