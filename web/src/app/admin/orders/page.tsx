'use client';

import { useState, useEffect, useCallback } from 'react';
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

const API_URL   = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const PAGE_SIZE = 25;

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
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);

  const fetchOrders = useCallback(async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) { router.replace('/admin/login'); return; }

    try {
      const res = await fetch(`${API_URL}/admin/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.replace('/admin/login'); return; }
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setOrders(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Reset to page 1 whenever search changes
  useEffect(() => { setPage(1); }, [search]);

  const filtered     = orders.filter((o) => {
    const q = search.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.buyerEmail.toLowerCase().includes(q) ||
      (o.buyerName ?? '').toLowerCase().includes(q) ||
      o.buyerPhone.includes(q)
    );
  });

  const totalRevenue = filtered.reduce((s, o) => s + o.totalAmount, 0);
  const totalPages   = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage     = Math.min(page, totalPages);
  const paged        = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-32">
        <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-center">
        <div>
          <p className="text-danger font-semibold mb-2">Failed to load orders</p>
          <p className="text-sm text-offblack/50 mb-4">{error}</p>
          <button onClick={fetchOrders} className="text-primary text-sm font-bold hover:underline">Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-offblack">Orders</h1>
          <p className="text-sm text-offblack/40 mt-0.5">{orders.length} paid order{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <a href="/admin" className="text-sm text-offblack/40 hover:text-offblack transition-colors">
          ← Dashboard
        </a>
      </div>

      {/* Search + summary */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by order #, name, email or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-xl border border-black/12 px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {search && (
          <div className="flex items-center gap-2 text-sm text-offblack/50 shrink-0 self-center">
            <span>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span className="font-bold text-offblack">₱{totalRevenue.toLocaleString()}</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-black/8 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-offblack/40 text-sm">
            {search ? 'No orders match your search.' : 'No orders yet.'}
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
                {paged.map((order) => (
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
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-black/10 bg-offwhite/60">
                    <td colSpan={5} className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">
                      Total
                    </td>
                    <td className="px-4 py-3 text-right font-black text-offblack">
                      ₱{totalRevenue.toLocaleString()}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 gap-4">
          <p className="text-xs text-offblack/40 shrink-0">
            Page {safePage} of {totalPages} &middot; {filtered.length} order{filtered.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {/* Prev */}
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-black/10
                bg-white text-offblack hover:bg-offwhite disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ←
            </button>

            {/* Page numbers */}
            {pageNumbers(safePage, totalPages).map((n, i) =>
              n === '…' ? (
                <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-sm text-offblack/30 select-none">…</span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(n as number)}
                  className={`min-w-[36px] px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                    ${safePage === n
                      ? 'bg-primary border-primary text-white'
                      : 'bg-white border-black/10 text-offblack hover:bg-offwhite'
                    }`}
                >
                  {n}
                </button>
              )
            )}

            {/* Next */}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
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
