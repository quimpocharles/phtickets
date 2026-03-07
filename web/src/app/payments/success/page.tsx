'use client';

import React, { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import type { CartOrderResponse } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

interface FlatTicket {
  _id: string;
  ticketId: string;
  qrCodeUrl: string;
  status: string;
  orderNumber: string;
  ticketTypeName: string;
  ticketTypeScope: string;
  orderTotal: number;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref');

  const [data, setData]     = useState<CartOrderResponse['data'] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!ref) { setStatus('error'); return; }

    let cancelled = false;

    async function fetchOrder(): Promise<boolean> {
      try {
        const res  = await fetch(`${API_URL}/tickets/order/cart/${ref}`);
        const json: CartOrderResponse = await res.json();
        if (res.ok && json.success) {
          if (!cancelled) { setData(json.data); setStatus('ready'); }
          return true;
        }
      } catch { /* ignore */ }
      return false;
    }

    async function poll() {
      if (await fetchOrder()) return;
      attemptsRef.current += 1;

      if (attemptsRef.current === 3) {
        try {
          const res  = await fetch(`${API_URL}/payments/process/${ref}`, { method: 'POST' });
          const json = await res.json();
          if (res.ok && json.success && !cancelled) {
            setData(json.data);
            setStatus('ready');
            return;
          }
        } catch { /* ignore */ }
      }

      if (await fetchOrder()) return;
      if (attemptsRef.current >= 12) { if (!cancelled) setStatus('error'); return; }
      if (!cancelled) setTimeout(poll, 5000);
    }

    poll();
    return () => { cancelled = true; };
  }, [ref]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-10 h-10 border-2 border-white/10 border-t-yellow-400 rounded-full animate-spin" />
        <p className="text-white font-semibold text-base">Confirming your payment…</p>
        <p className="text-white/40 text-sm text-center max-w-xs">
          This usually takes a few seconds. Please don&apos;t close this page.
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-white font-bold text-lg">Payment received!</p>
        <p className="text-white/50 text-sm text-center max-w-sm">
          Your tickets are being processed. Check your email — we&apos;ll send your QR codes there shortly.
        </p>
        <a href="/" className="mt-2 text-yellow-400 text-sm hover:text-yellow-300 transition-colors">
          ← Back to games
        </a>
      </div>
    );
  }

  const { game, buyer, grandTotal, orders } = data!;
  const gameDate = new Date(game.gameDate);
  const dateStr  = gameDate.toLocaleDateString('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
  });
  const timeStr = gameDate.toLocaleTimeString('en-PH', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila',
  });

  const allTickets: FlatTicket[] = orders.flatMap((o) =>
    o.tickets.map((t) => ({
      ...t,
      orderNumber:     o.orderNumber,
      ticketTypeName:  o.ticketTypeName,
      ticketTypeScope: o.ticketTypeScope,
      orderTotal:      o.totalAmount,
    }))
  );

  return (
    <div className="min-h-screen bg-black py-8 px-4">

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #f3f4f6 !important; margin: 0; }
          .ticket-card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      {/* ── Actions bar ── */}
      <div className="no-print max-w-2xl mx-auto mb-8 flex items-center justify-between">
        <a href="/" className="text-sm text-white/40 hover:text-white/70 transition-colors">
          ← Back to games
        </a>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Save / Print
        </button>
      </div>

      {/* ── Ticket cards ── */}
      <div className="flex flex-col gap-8 items-center">
        {allTickets.map((ticket, idx) => (
          <div
            key={ticket._id}
            className="ticket-card w-full max-w-2xl shadow-2xl flex"
            style={{ borderRadius: '20px', overflow: 'hidden', height: 460 }}
          >
            {/* ── Left: fixed 345×460 = exact 3:4 ratio → image fills with no black bars ── */}
            <div className="relative bg-black shrink-0" style={{ width: 345, height: 460 }}>
              <Image
                src="/smart-gh.jpg"
                alt="Smart Global Hoops 2026"
                fill
                className="object-contain"
                unoptimized
                priority
              />
            </div>

            {/* ── Right: all ticket content ── */}
            <div className="flex flex-col flex-1 min-w-0">

              {/* Ticket type band */}
              <div className="bg-gray-900 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-black text-sm uppercase tracking-wide leading-tight" style={{ color: '#fed000' }}>
                    {ticket.ticketTypeName}
                  </p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {ticket.ticketTypeScope === 'all' ? 'All Events Pass' : 'Single Day Pass'}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-white/30 text-[10px] uppercase tracking-wider">Ticket</p>
                  <p className="text-white font-bold text-sm">{idx + 1} / {allTickets.length}</p>
                </div>
              </div>

              {/* Event details */}
              <div className="bg-white px-4 pt-4 pb-3 flex-1">
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Date &amp; Time</p>
                    <p className="text-xs font-semibold text-gray-900 mt-0.5">{dateStr}</p>
                    <p className="text-[11px] text-gray-500">{timeStr}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Total Paid</p>
                    <p className="text-lg font-black text-gray-900 mt-0.5">₱{grandTotal.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Ticket No.</p>
                    <p className="text-[10px] font-bold font-mono text-gray-900 mt-0.5 tracking-wide">{ticket.ticketId}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Venue</p>
                    <p className="text-[11px] text-gray-700 mt-0.5">{game.venue}</p>
                  </div>
                  {buyer.name && (
                    <div className="col-span-2">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Ticket Holder</p>
                      <p className="text-xs font-semibold text-gray-900 mt-0.5">{buyer.name}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Perforated divider */}
              <div className="relative bg-white py-2">
                <div
                  className="absolute -left-4 top-1/2 -translate-y-1/2 rounded-full bg-black"
                  style={{ width: 32, height: 32 }}
                />
                <div
                  className="absolute -right-4 top-1/2 -translate-y-1/2 rounded-full bg-black"
                  style={{ width: 32, height: 32 }}
                />
                <div className="mx-4 border-t-2 border-dashed border-gray-200" />
              </div>

              {/* QR code */}
              <div className="bg-white flex flex-col items-center px-4 pt-3 pb-4">
                <div
                  className="bg-white"
                  style={{ padding: 8, border: '2px solid #f3f4f6', borderRadius: 12, display: 'inline-block' }}
                >
                  {ticket.qrCodeUrl ? (
                    <Image
                      src={ticket.qrCodeUrl}
                      alt={`QR code — ${ticket.ticketId}`}
                      width={160}
                      height={160}
                      unoptimized
                      priority
                    />
                  ) : (
                    <div
                      style={{ width: 160, height: 160, background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <span className="text-xs text-gray-400">Loading QR…</span>
                    </div>
                  )}
                </div>
                <p className="mt-2 font-mono text-[10px] text-gray-400 tracking-widest">{ticket.ticketId}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-gray-500">Present at venue entrance</p>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 border-t border-gray-100 px-4 py-2.5 text-center">
                <p className="text-[10px] text-gray-400">
                  Non-transferable &middot; Valid for one entry only &middot; Do not share QR code
                </p>
              </div>

            </div>
          </div>
        ))}

        <p className="no-print text-xs text-white/30 pb-8 text-center">
          Tickets also sent to {buyer.email}
        </p>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
