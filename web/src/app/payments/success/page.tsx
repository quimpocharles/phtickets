'use client';

import React, { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

interface Ticket {
  _id: string;
  ticketId: string;
  qrCodeUrl: string;
  status: string;
}

interface Order {
  orderNumber: string;
  buyerName: string | null;
  buyerEmail: string;
  quantity: number;
  totalAmount: number;
  gameId: {
    description: string;
    venue: string;
    gameDate: string;
    eventEndDate: string;
  };
  ticketTypeId: {
    name: string;
    price: number;
    scope: string;
  };
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref');

  const [order, setOrder]     = useState<Order | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [status, setStatus]   = useState<'loading' | 'ready' | 'error'>('loading');
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!ref) { setStatus('error'); return; }

    let cancelled = false;

    async function fetchOrder(): Promise<boolean> {
      try {
        const res  = await fetch(`${API_URL}/tickets/order/${ref}`);
        const json = await res.json();
        if (res.ok && json.success) {
          if (!cancelled) {
            setOrder(json.data.order);
            setTickets(json.data.tickets);
            setStatus('ready');
          }
          return true;
        }
      } catch { /* ignore */ }
      return false;
    }

    async function poll() {
      // First try: check if webhook already processed it
      if (await fetchOrder()) return;
      attemptsRef.current += 1;

      // After 3 failed polls (~9s), trigger the client-side fallback
      if (attemptsRef.current === 3) {
        try {
          await fetch(`${API_URL}/payments/process/${ref}`, { method: 'POST' });
        } catch { /* ignore */ }
      }

      if (await fetchOrder()) return;

      if (attemptsRef.current >= 12) {
        if (!cancelled) setStatus('error');
        return;
      }
      if (!cancelled) setTimeout(poll, 5000);
    }

    poll();
    return () => { cancelled = true; };
  }, [ref]);

  function handlePrint() {
    window.print();
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-10 h-10 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
        <p className="text-gray-800 font-semibold text-base">Confirming your payment…</p>
        <p className="text-gray-400 text-sm text-center max-w-xs">
          This usually takes a few seconds. Please don&apos;t close this page.
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-gray-800 font-bold text-lg">Payment received!</p>
        <p className="text-gray-500 text-sm text-center max-w-sm">
          Your tickets are being processed. Check your email — we&apos;ll send your QR codes there shortly.
        </p>
        <a href="/" className="mt-2 text-gray-500 text-sm hover:underline">
          ← Back to games
        </a>
      </div>
    );
  }

  const game     = order!.gameId;
  const gameDate = new Date(game.gameDate);
  const dateStr  = gameDate.toLocaleDateString('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  const timeStr = gameDate.toLocaleTimeString('en-PH', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const isAllEvents = order!.ticketTypeId.scope === 'all';

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">

      {/* ── Print styles ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; margin: 0; }
          .ticket-card { break-inside: avoid; page-break-inside: avoid; box-shadow: none !important; border: 1px solid #e5e7eb !important; }
        }
      `}</style>

      {/* ── Actions bar (screen only) ── */}
      <div className="no-print max-w-sm mx-auto mb-6 flex items-center justify-between">
        <a href="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to games
        </a>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Save / Print
        </button>
      </div>

      {/* ── Ticket cards ── */}
      <div className="flex flex-col gap-6 items-center">
        {tickets.map((ticket, idx) => (
          <div
            key={ticket._id}
            className="ticket-card bg-white w-full max-w-sm rounded-2xl shadow-lg overflow-hidden"
          >
            {/* ── Logo area ── */}
            <div className="flex flex-col items-center pt-10 pb-6 px-8 border-b border-dashed border-gray-200">
              <Image
                src="/nbtc-logo.jpg"
                alt="NBTC Logo"
                width={90}
                height={90}
                className="object-contain mb-6"
                unoptimized
              />

              {/* Event name */}
              <h2 className="text-xl font-bold text-gray-900 text-center leading-snug mb-6">
                {game.description}
              </h2>

              {/* Detail grid */}
              <div className="w-full flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <TicketDetail label="Date &amp; Time">
                    <span className="font-semibold text-gray-900">{dateStr}</span>
                    <span className="text-gray-500 text-sm">{timeStr}</span>
                  </TicketDetail>
                  <TicketDetail label="Total Paid" align="right">
                    <span className="font-bold text-gray-900 text-lg">
                      ₱{order!.totalAmount.toLocaleString()}
                    </span>
                  </TicketDetail>
                </div>

                <div className="flex justify-between items-start">
                  <TicketDetail label="Order Number">
                    <span className="font-mono font-semibold text-gray-900 tracking-wide">
                      {order!.orderNumber}
                    </span>
                  </TicketDetail>
                  <TicketDetail label="Ticket" align="right">
                    <span className="font-semibold text-gray-900">
                      {idx + 1} / {tickets.length}
                    </span>
                  </TicketDetail>
                </div>

                <TicketDetail label="Ticket Type">
                  <span className="font-semibold text-gray-900">{order!.ticketTypeId.name}</span>
                  <span className="text-gray-500 text-sm">
                    {isAllEvents ? 'Valid all event days' : 'Single day pass'}
                  </span>
                </TicketDetail>

                <TicketDetail label="Venue">
                  <span className="text-gray-700">{game.venue}</span>
                </TicketDetail>

                {order!.buyerName && (
                  <TicketDetail label="Holder">
                    <span className="text-gray-700">{order!.buyerName}</span>
                  </TicketDetail>
                )}
              </div>
            </div>

            {/* ── QR code area ── */}
            <div className="flex flex-col items-center py-8 px-8">
              {ticket.qrCodeUrl ? (
                <Image
                  src={ticket.qrCodeUrl}
                  alt={`QR code for ${ticket.ticketId}`}
                  width={220}
                  height={220}
                  unoptimized
                />
              ) : (
                <div className="w-56 h-56 bg-gray-100 flex items-center justify-center">
                  <span className="text-xs text-gray-400">Loading QR…</span>
                </div>
              )}
              <p className="mt-3 font-mono text-xs text-gray-400 tracking-widest">
                {ticket.ticketId}
              </p>
              <p className="mt-1 text-xs text-gray-400">Scan at entrance</p>
            </div>
          </div>
        ))}

        <p className="no-print text-xs text-gray-400 pb-8 text-center">
          Tickets also sent to {order!.buyerEmail}
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

interface TicketDetailProps {
  label: string;
  children: React.ReactNode;
  align?: 'left' | 'right';
}

function TicketDetail({ label, children, align = 'left' }: TicketDetailProps) {
  return (
    <div className={`flex flex-col gap-0.5 ${align === 'right' ? 'items-end text-right' : ''}`}>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
