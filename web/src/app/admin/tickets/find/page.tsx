'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface Ticket {
  _id: string;
  ticketId: string;
  qrCodeUrl: string;
  status: 'unused' | 'used';
}

interface Order {
  _id: string;
  orderNumber: string;
  buyerName: string | null;
  buyerEmail: string;
  buyerPhone: string;
  country: string | null;
  quantity: number;
  totalAmount: number;
  createdAt: string;
  gameId:       { description: string; venue: string; gameDate: string } | null;
  ticketTypeId: { name: string; scope: string; price: number } | null;
}

interface Result {
  order: Order;
  tickets: Ticket[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function AdminFindTicketsPage() {
  const router  = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;

    setLoading(true);
    setError(null);
    setResults(null);
    setExpanded(null);

    const token = localStorage.getItem('adminToken');
    if (!token) { router.replace('/admin/login'); return; }

    try {
      const res  = await fetch(`${API_URL}/admin/orders/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { localStorage.removeItem('adminToken'); router.replace('/admin/login'); return; }
      const json = await res.json();
      if (!res.ok) { setError(json.message ?? 'Search failed.'); return; }
      setResults(json.data);
      if (json.data.length === 1) setExpanded(json.data[0].order._id);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const totalTickets = results?.reduce((s, r) => s + r.tickets.length, 0) ?? 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">

      <div className="mb-6">
        <h1 className="text-2xl font-black text-offblack">Find Passes</h1>
        <p className="text-sm text-offblack/40 mt-1">Search by buyer name or email address.</p>
      </div>

      {/* ── Search form ── */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          ref={inputRef}
          type="text"
          placeholder="Name or email…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setError(null); }}
          className="flex-1 rounded-xl border border-black/12 px-4 py-2.5 text-sm bg-white
            focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
        />
        <button
          type="submit"
          disabled={loading || query.trim().length < 2}
          className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed
            text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all active:scale-[0.98]
            flex items-center gap-2 shrink-0"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
          )}
          Search
        </button>
      </form>

      {error && (
        <p className="text-sm text-danger font-medium bg-danger/5 rounded-xl px-4 py-3 mb-4">{error}</p>
      )}

      {/* ── Results ── */}
      {results !== null && (
        <>
          <p className="text-sm text-offblack/40 mb-3">
            {results.length === 0
              ? 'No passes found.'
              : `${results.length} order${results.length !== 1 ? 's' : ''} · ${totalTickets} pass${totalTickets !== 1 ? 'es' : ''}`}
          </p>

          <div className="flex flex-col gap-3">
            {results.map(({ order, tickets }) => {
              const isOpen   = expanded === order._id;
              const gameDate = order.gameId ? new Date(order.gameId.gameDate) : null;
              const dateStr  = gameDate?.toLocaleDateString('en-PH', {
                month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
              });

              return (
                <div key={order._id} className="bg-white rounded-2xl border border-black/8 shadow-sm overflow-hidden">

                  {/* ── Order header ── */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : order._id)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-offwhite/60 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-offblack text-sm">{order.buyerName || '—'}</p>
                        {order.country && (
                          <span className="text-[10px] font-bold uppercase tracking-wide bg-black/6 text-offblack/50 px-2 py-0.5 rounded-full">
                            {order.country}
                          </span>
                        )}
                        {order.ticketTypeId?.scope === 'all' && (
                          <span className="text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            VIP
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-offblack/40 mt-0.5">{order.buyerEmail}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="font-mono text-xs text-offblack/50">{order.orderNumber}</span>
                        <span className="text-offblack/20">·</span>
                        <span className="text-xs text-offblack/50">{order.ticketTypeId?.name ?? '—'}</span>
                        <span className="text-offblack/20">·</span>
                        <span className="text-xs text-offblack/50">{dateStr ?? '—'}</span>
                        <span className="text-offblack/20">·</span>
                        <span className="text-xs font-bold text-offblack">₱{order.totalAmount.toLocaleString()}</span>
                        <span className="text-offblack/20">·</span>
                        <span className="text-xs text-offblack/50">{tickets.length} pass{tickets.length !== 1 ? 'es' : ''}</span>
                      </div>
                    </div>
                    <svg
                      className={`w-4 h-4 text-offblack/30 shrink-0 ml-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* ── Tickets ── */}
                  {isOpen && (
                    <div className="border-t border-black/6">
                      {tickets.length === 0 ? (
                        <p className="px-5 py-4 text-sm text-offblack/40">No passes generated yet.</p>
                      ) : (
                        tickets.map((ticket, idx) => (
                          <div
                            key={ticket._id}
                            className={`flex items-center gap-4 px-5 py-4 ${idx > 0 ? 'border-t border-dashed border-black/6' : ''}`}
                          >
                            {/* QR */}
                            <div className="shrink-0 bg-white p-1.5 border border-black/8 rounded-xl">
                              {ticket.qrCodeUrl ? (
                                <Image
                                  src={ticket.qrCodeUrl}
                                  alt={ticket.ticketId}
                                  width={80}
                                  height={80}
                                  unoptimized
                                />
                              ) : (
                                <div className="w-20 h-20 bg-offwhite rounded-lg flex items-center justify-center">
                                  <span className="text-[10px] text-offblack/30">No QR</span>
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-mono font-bold text-sm text-offblack tracking-wide">{ticket.ticketId}</p>
                              <p className="text-xs text-offblack/40 mt-0.5">
                                {idx + 1} of {tickets.length} · {order.gameId?.venue ?? '—'}
                              </p>
                            </div>

                            {/* Status */}
                            <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full
                              ${ticket.status === 'used'
                                ? 'bg-danger/10 text-danger'
                                : 'bg-emerald-50 text-emerald-700'
                              }`}>
                              {ticket.status === 'used' ? 'Used' : 'Valid'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
