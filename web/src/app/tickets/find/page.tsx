'use client';

import React, { useState } from 'react';
import Image from 'next/image';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

interface Ticket {
  _id: string;
  ticketId: string;
  qrCodeUrl: string;
  status: string;
}

interface Order {
  _id: string;
  orderNumber: string;
  buyerName: string | null;
  buyerEmail: string;
  quantity: number;
  totalAmount: number;
  createdAt: string;
  gameId: { description: string; venue: string; gameDate: string; eventEndDate: string };
  ticketTypeId: { name: string; price: number; scope: string };
}

interface Result {
  order: Order;
  tickets: Ticket[];
}

export default function FindTicketPage() {
  const [email, setEmail]   = useState('');
  const [phone, setPhone]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResults(null);
    setLoading(true);

    try {
      const params = new URLSearchParams({ email: email.trim(), phone: phone.trim() });
      const res  = await fetch(`${API_URL}/tickets/find?${params}`);
      const json = await res.json();

      if (!res.ok) {
        setError(json.message ?? 'No tickets found.');
        return;
      }
      setResults(json.data);
      if (json.data.length === 1) setExpanded(json.data[0].order._id);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-black text-gray-900">Find My Tickets</h1>
          <p className="text-gray-500 text-sm mt-1">
            Enter the email and phone number you used when purchasing.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4 mb-6">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              placeholder="09171234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
            <p className="text-xs text-gray-400">Philippine mobile number used at checkout</p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Searching…
              </>
            ) : 'Find My Tickets'}
          </button>
        </form>

        {/* Results */}
        {results && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-500 text-center">
              Found <span className="font-bold text-gray-900">{results.length}</span> order{results.length !== 1 ? 's' : ''}
            </p>

            {results.map(({ order, tickets }) => {
              const game     = order.gameId;
              const gameDate = new Date(game.gameDate);
              const dateStr  = gameDate.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
              const timeStr  = gameDate.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
              const isOpen   = expanded === order._id;

              return (
                <div key={order._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                  {/* Order header — always visible, tap to expand */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : order._id)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{game.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{dateStr} · {game.venue}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs font-mono text-gray-500">{order.orderNumber}</span>
                        <span className="text-xs text-gray-400">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</span>
                        <span className="text-xs font-bold text-gray-900">₱{order.totalAmount.toLocaleString()}</span>
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Ticket cards — visible when expanded */}
                  {isOpen && (
                    <div className="border-t border-gray-100">
                      {tickets.map((ticket, idx) => (
                        <div key={ticket._id} className={`px-5 py-5 flex flex-col items-center gap-4 ${idx > 0 ? 'border-t border-dashed border-gray-200' : ''}`}>
                          {/* Details */}
                          <div className="w-full flex justify-between items-start text-sm">
                            <div className="flex flex-col gap-0.5">
                              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Ticket Type</p>
                              <p className="font-semibold text-gray-900">{order.ticketTypeId.name}</p>
                            </div>
                            <div className="flex flex-col gap-0.5 items-end">
                              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Time</p>
                              <p className="font-semibold text-gray-900">{timeStr}</p>
                            </div>
                          </div>

                          {/* QR code */}
                          <div className="flex flex-col items-center gap-2">
                            {ticket.qrCodeUrl ? (
                              <Image
                                src={ticket.qrCodeUrl}
                                alt={`QR for ${ticket.ticketId}`}
                                width={200}
                                height={200}
                                unoptimized
                              />
                            ) : (
                              <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                                <span className="text-xs text-gray-400">No QR available</span>
                              </div>
                            )}
                            <p className="font-mono text-xs text-gray-400 tracking-widest">{ticket.ticketId}</p>
                            <p className="text-xs text-gray-400">
                              {ticket.status === 'used' ? '✓ Already scanned' : 'Scan at entrance'}
                            </p>
                          </div>

                          {/* Ticket number badge */}
                          <p className="text-xs text-gray-400">{idx + 1} / {tickets.length}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          Can&apos;t find your tickets?{' '}
          <a href="/tickets" className="text-gray-600 hover:underline">Browse upcoming games</a>
        </p>
      </div>
    </div>
  );
}
