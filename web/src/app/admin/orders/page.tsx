'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Order {
  _id: string;
  orderNumber: string;
  buyerName: string | null;
  buyerEmail: string;
  buyerPhone: string;
  quantity: number;
  totalAmount: number;
  paymentStatus: string;
  paymentReference: string;
  createdAt: string;
  gameId: { description: string; venue: string; gameDate: string } | null;
  ticketTypeId: { name: string; price: number } | null;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const API_URL   = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const PAGE_SIZE = 25;
const DEBOUNCE_MS = 350;

// ── Pagination helpers ────────────────────────────────────────────────────────

function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', current - 1, current, current + 1, '…', total];
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [meta,    setMeta]    = useState<Meta>({ total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);

  // Debounced search value — only sent to the API after user stops typing
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), DEBOUNCE_MS);
  };

  const fetchOrders = useCallback(async (p: number, q: string) => {
    const token = localStorage.getItem('adminToken');
    if (!token) { router.replace('/admin/login'); return; }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page:  String(p),
        limit: String(PAGE_SIZE),
        ...(q.trim() ? { q: q.trim() } : {}),
      });
      const res = await fetch(`${API_URL}/admin/orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.replace('/admin/login'); return; }
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setOrders(json.data);
      setMeta(json.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchOrders(page, debouncedSearch);
  }, [fetchOrders, page, debouncedSearch]);

  const pageRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-offblack">Orders</h1>
          <p className="text-sm text-offblack/40 mt-0.5">
            {meta.total} paid order{meta.total !== 1 ? 's' : ''}
          </p>
        </div>
        <a href="/admin" className="text-sm text-offblack/40 hover:text-offblack transition-colors">
          ← Dashboard
        </a>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by order #, name, email or phone…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="flex-1 rounded-xl border border-black/12 px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {debouncedSearch && !loading && (
          <div className="flex items-center gap-2 text-sm text-offblack/50 shrink-0 self-center">
            <span>{meta.total} result{meta.total !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center justify-center p-8 text-center">
          <div>
            <p className="text-danger font-semibold mb-2">Failed to load orders</p>
            <p className="text-sm text-offblack/50 mb-4">{error}</p>
            <button
              onClick={() => fetchOrders(page, debouncedSearch)}
              className="text-primary text-sm font-bold hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-black/8 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="px-6 py-12 text-center text-offblack/40 text-sm">
            {debouncedSearch ? 'No orders match your search.' : 'No orders yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/6 bg-offwhite/60">
                  <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">Order</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">Buyer</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">Game</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">Pass Type</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">Amount</th>
                  <th className="text-right px-5 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {orders.map((order) => (
                  <tr key={order._id} className="hover:bg-offwhite/50 transition-colors">
                    <td className="px-5 py-3">
                      <span className="font-mono font-semibold text-offblack text-xs tracking-wide">
                        {order.orderNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-offblack">{order.buyerName || '—'}</p>
                      <p className="text-xs text-offblack/40">{order.buyerEmail}</p>
                      <p className="text-xs text-offblack/40">{order.buyerPhone}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="font-medium text-offblack truncate">{order.gameId?.description ?? '—'}</p>
                      <p className="text-xs text-offblack/40">{order.gameId?.venue ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 text-offblack/70">
                      {order.ticketTypeId?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-offblack">
                      {order.quantity}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-offblack">
                      ₱{order.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-offblack/40 whitespace-nowrap">
                      {new Date(order.createdAt).toLocaleDateString('en-PH', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                      <br />
                      {new Date(order.createdAt).toLocaleTimeString('en-PH', {
                        hour: 'numeric', minute: '2-digit', hour12: true,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black/10 bg-offwhite/60">
                  <td colSpan={5} className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">
                    Page Total
                  </td>
                  <td className="px-4 py-3 text-right font-black text-offblack">
                    ₱{pageRevenue.toLocaleString()}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 gap-4">
          <p className="text-xs text-offblack/40 shrink-0">
            Page {meta.page} of {meta.totalPages} &middot; {meta.total} order{meta.total !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1 flex-wrap justify-end">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-black/10
                bg-white text-offblack hover:bg-offwhite disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ←
            </button>

            {pageNumbers(meta.page, meta.totalPages).map((n, i) =>
              n === '…' ? (
                <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-sm text-offblack/30 select-none">…</span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(n as number)}
                  disabled={loading}
                  className={`min-w-[36px] px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                    ${meta.page === n
                      ? 'bg-primary border-primary text-white'
                      : 'bg-white border-black/10 text-offblack hover:bg-offwhite'
                    }`}
                >
                  {n}
                </button>
              )
            )}

            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page === meta.totalPages || loading}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-black/10
                bg-white text-offblack hover:bg-offwhite disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
