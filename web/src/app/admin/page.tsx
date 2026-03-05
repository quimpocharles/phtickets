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

interface Stats {
  totalRevenue: number;
  totalSold: number;
  upcomingGames: number;
  trendingGames: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

  const fetchDashboard = useCallback(async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) { router.replace('/admin/login'); return; }

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

      const data: GameSummary[] = json.data;
      setGames(data);

      const now = new Date();
      const upcoming = data.filter((g) => new Date(g.eventEndDate) >= now);
      const trending = upcoming.filter(
        (g) => g.ticketsSold > 0 &&
          g.ticketsSold / (g.ticketsSold + g.ticketsRemaining) >= 0.1
      );

      setStats({
        totalRevenue:  data.reduce((s, g) => s + g.totalRevenue, 0),
        totalSold:     data.reduce((s, g) => s + g.ticketsSold, 0),
        upcomingGames: upcoming.length,
        trendingGames: trending.length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, [API_URL, router]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  async function handleDelete(gameId: string) {
    setDeleting(true);
    const token = localStorage.getItem('adminToken');

    try {
      const res = await fetch(`${API_URL}/admin/games/${gameId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem('adminToken');
        router.replace('/admin/login');
        return;
      }

      if (res.ok) {
        setGames((prev) => prev.filter((g) => g._id !== gameId));
        setStats((prev) => {
          if (!prev) return prev;
          const deleted = games.find((g) => g._id === gameId);
          if (!deleted) return prev;
          const upcoming = games.filter(
            (g) => g._id !== gameId && new Date(g.eventEndDate) >= new Date()
          );
          return {
            totalRevenue:  prev.totalRevenue - deleted.totalRevenue,
            totalSold:     prev.totalSold - deleted.ticketsSold,
            upcomingGames: upcoming.length,
            trendingGames: prev.trendingGames,
          };
        });
      }
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-32">
        <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-danger font-semibold mb-2">Failed to load dashboard</p>
          <p className="text-sm text-offblack/50 mb-4">{error}</p>
          <button onClick={fetchDashboard} className="text-primary text-sm font-bold hover:underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const now = new Date();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black text-offblack">Dashboard</h1>
          <a
            href="/admin/games/new"
            className="bg-primary hover:bg-primary/90 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all active:scale-[0.98]"
          >
            + Add Game
          </a>
        </div>

        {/* ── Stat cards ── */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Revenue"   value={`₱${stats.totalRevenue.toLocaleString()}`} icon="💰" color="bg-primary" />
            <StatCard label="Tickets Sold"    value={stats.totalSold.toLocaleString()}           icon="🎟️" color="bg-offblack" />
            <StatCard label="Upcoming Games"  value={stats.upcomingGames.toLocaleString()}        icon="📅" color="bg-primary" />
            <StatCard label="Trending Games"  value={stats.trendingGames.toLocaleString()}        icon="🔥" color="bg-danger" />
          </div>
        )}

        {/* ── Games table ── */}
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-black/8">
            <h2 className="font-bold text-offblack">All Games</h2>
            <p className="text-xs text-offblack/40 mt-0.5">
              {games.length} game{games.length !== 1 ? 's' : ''} total
            </p>
          </div>

          {games.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-offblack/40 text-sm mb-3">No games yet.</p>
              <a href="/admin/games/new" className="text-primary text-sm font-bold hover:underline">
                + Add your first game
              </a>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/6 bg-offwhite/60">
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">Game</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">Venue</th>
                    <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">Tickets Sold</th>
                    <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">Remaining</th>
                    <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">Revenue</th>
                    <th className="text-right px-6 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-black/5">
                  {games.map((game) => {
                    const isUpcoming = new Date(game.eventEndDate) >= now;
                    const total = game.ticketsSold + game.ticketsRemaining;
                    const soldPct = total > 0 ? game.ticketsSold / total : 0;
                    const isConfirming = confirmDeleteId === game._id;

                    return (
                      <tr key={game._id} className="hover:bg-offwhite/50 transition-colors">

                        {/* Game */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-offblack">
                              {game.description}
                            </p>
                            {isUpcoming && (
                              <span className="text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                                Upcoming
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Date */}
                        <td className="px-4 py-4 text-offblack/60 whitespace-nowrap">
                          {(() => {
                            const start = new Date(game.gameDate);
                            const end   = new Date(game.eventEndDate);
                            const isSameDay = start.toDateString() === end.toDateString();
                            return isSameDay
                              ? start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                              : `${start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}–${end.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                          })()}
                        </td>

                        {/* Venue */}
                        <td className="px-4 py-4 text-offblack/60 max-w-[160px] truncate">
                          {game.venue}
                        </td>

                        {/* Tickets Sold */}
                        <td className="px-4 py-4 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-semibold text-offblack">{game.ticketsSold.toLocaleString()}</span>
                            {total > 0 && (
                              <div className="w-16 h-1 bg-black/8 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${soldPct >= 0.75 ? 'bg-danger' : soldPct >= 0.5 ? 'bg-accent' : 'bg-primary'}`}
                                  style={{ width: `${soldPct * 100}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Remaining */}
                        <td className="px-4 py-4 text-right">
                          <span className={`font-semibold ${game.ticketsRemaining === 0 ? 'text-danger' : 'text-offblack'}`}>
                            {game.ticketsRemaining.toLocaleString()}
                          </span>
                        </td>

                        {/* Revenue */}
                        <td className="px-4 py-4 text-right font-bold text-offblack">
                          ₱{game.totalRevenue.toLocaleString()}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          {isConfirming ? (
                            /* Delete confirmation */
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-offblack/50 mr-1">Delete?</span>
                              <button
                                onClick={() => handleDelete(game._id)}
                                disabled={deleting}
                                className="text-xs font-bold text-white bg-danger hover:bg-danger/80 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {deleting ? '…' : 'Yes'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                disabled={deleting}
                                className="text-xs font-bold text-offblack/60 hover:text-offblack border border-black/12 px-2.5 py-1 rounded-lg transition-colors"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            /* Normal actions */
                            <div className="flex items-center justify-end gap-3">
                              <a
                                href={`/admin/games/${game._id}/edit`}
                                className="text-xs font-bold text-offblack/50 hover:text-offblack transition-colors"
                              >
                                Edit
                              </a>
                              <button
                                onClick={() => setConfirmDeleteId(game._id)}
                                className="text-xs font-bold text-danger/60 hover:text-danger transition-colors"
                              >
                                Delete
                              </button>
                              <a
                                href={`/admin/games/${game._id}/tickets`}
                                className="text-xs font-bold text-primary hover:text-primary/70 transition-colors whitespace-nowrap"
                              >
                                Manage Tickets
                              </a>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Totals footer */}
                {stats && games.length > 1 && (
                  <tfoot>
                    <tr className="border-t-2 border-black/10 bg-offwhite/60">
                      <td colSpan={3} className="px-6 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">
                        Totals
                      </td>
                      <td className="px-4 py-3 text-right font-black text-offblack">
                        {stats.totalSold.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-offblack">
                        {games.reduce((s, g) => s + g.ticketsRemaining, 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-offblack">
                        ₱{stats.totalRevenue.toLocaleString()}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-5">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${color} mb-3`}>
        <span className="text-base">{icon}</span>
      </div>
      <p className="text-2xl font-black text-offblack leading-tight">{value}</p>
      <p className="text-xs text-offblack/40 font-medium mt-0.5">{label}</p>
    </div>
  );
}
