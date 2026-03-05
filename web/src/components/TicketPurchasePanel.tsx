'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Game, TicketType } from '@/types';
import TicketTypeCard from './TicketTypeCard';
import { purchaseTickets } from '@/lib/api';

interface Props {
  game: Game;
}

interface FormState {
  email: string;
  phone: string;
  name: string;
}

interface Reservation {
  checkoutUrl: string;
  expiresAt: string;
}

const EMPTY_FORM: FormState = { email: '', phone: '', name: '' };

export default function TicketPurchasePanel({ game }: Props) {
  const router = useRouter();

  const [selectedType, setSelectedType] = useState<TicketType | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [timeLeft, setTimeLeft] = useState(0); // seconds

  const remaining = selectedType ? selectedType.available : 0;
  const maxQty = Math.min(remaining, 15);
  const total = selectedType ? selectedType.price * quantity : 0;
  const overLimit = quantity > remaining;
  const expired = reservation !== null && timeLeft === 0;

  // ── Countdown timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!reservation) return;

    const calc = () =>
      Math.max(0, Math.floor((new Date(reservation.expiresAt).getTime() - Date.now()) / 1000));

    setTimeLeft(calc());

    const id = setInterval(() => {
      const left = calc();
      setTimeLeft(left);
      if (left === 0) {
        clearInterval(id);
        // Refresh server-component data so availability is up to date
        router.refresh();
      }
    }, 1000);

    return () => clearInterval(id);
  }, [reservation, router]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function selectType(tt: TicketType) {
    setSelectedType(tt);
    setQuantity(1);
    setApiError(null);
    setErrors({});
    setReservation(null);
  }

  function changeQty(delta: number) {
    setQuantity((q) => Math.min(maxQty, Math.max(1, q + delta)));
  }

  function validate(): boolean {
    const next: Partial<FormState> = {};
    if (!form.email.trim()) {
      next.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = 'Enter a valid email address.';
    }
    if (!form.phone.trim()) {
      next.phone = 'Phone number is required.';
    } else if (!/^(09|\+639)\d{9}$/.test(form.phone.trim())) {
      next.phone = 'Enter a valid PH number (e.g. 09171234567).';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedType || !validate()) return;

    setLoading(true);
    setApiError(null);

    try {
      const res = await purchaseTickets({
        ticketTypeId: selectedType._id,
        quantity,
        buyerEmail: form.email.trim(),
        buyerPhone: form.phone.trim(),
        buyerName: form.name.trim() || undefined,
      });
      // Show countdown instead of immediately redirecting
      setReservation({ checkoutUrl: res.data.checkoutUrl, expiresAt: res.data.expiresAt });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Format MM:SS ──────────────────────────────────────────────────────────
  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">
      {/* Left — Ticket type selection */}
      <div className="lg:col-span-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-offblack/40 mb-3">
          Select Ticket Type
        </h2>

        {game.ticketTypes.length === 0 ? (
          <div className="rounded-xl border border-black/10 p-8 text-center text-offblack/40">
            No ticket types available for this game yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {game.ticketTypes.map((tt) => (
              <TicketTypeCard
                key={tt._id}
                ticketType={tt}
                selected={selectedType?._id === tt._id}
                onClick={() => selectType(tt)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right — Checkout form / Reservation timer */}
      <div className="lg:col-span-1">
        <div className="lg:sticky lg:top-6">

          {/* ── No ticket selected ── */}
          {!selectedType && (
            <div className="rounded-2xl border-2 border-dashed border-black/15 p-8 flex flex-col items-center justify-center text-center gap-2 min-h-[220px]">
              <div className="w-10 h-10 rounded-full bg-primary/8 flex items-center justify-center mb-1">
                <svg className="w-5 h-5 text-primary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-offblack/50">Select a ticket type</p>
              <p className="text-xs text-offblack/30">to continue with checkout</p>
            </div>
          )}

          {/* ── Reservation countdown ── */}
          {selectedType && reservation && (
            <div className="rounded-2xl bg-white border border-black/8 shadow-sm overflow-hidden animate-fade-in-up">
              {/* Header */}
              <div className={`px-5 py-4 ${expired ? 'bg-offblack' : 'bg-primary'}`}>
                <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-0.5">
                  {expired ? 'Reservation Expired' : 'Reservation Confirmed'}
                </p>
                <p className="text-white font-black text-lg leading-tight">
                  {expired ? 'Your hold has ended' : 'Tickets reserved for you'}
                </p>
                <p className="text-white/70 text-sm">
                  {selectedType.name} · {quantity} ticket{quantity > 1 ? 's' : ''}
                </p>
              </div>

              <div className="px-5 py-6 flex flex-col items-center gap-5">
                {expired ? (
                  /* Expired state */
                  <>
                    <div className="text-center">
                      <p className="text-sm text-offblack/60 mb-1">
                        Your reserved seats have been released.
                      </p>
                      <p className="text-xs text-offblack/40">
                        Availability has been refreshed — please select again.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setReservation(null); setSelectedType(null); }}
                      className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98]"
                    >
                      Choose Tickets Again
                    </button>
                  </>
                ) : (
                  /* Active countdown state */
                  <>
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-xs font-semibold uppercase tracking-widest text-offblack/40">
                        Time remaining
                      </p>
                      <div className="flex items-center gap-1 tabular-nums">
                        <span className="text-5xl font-black text-offblack">{mins}</span>
                        <span className="text-3xl font-black text-offblack/30 mb-1">:</span>
                        <span className="text-5xl font-black text-offblack">{secs}</span>
                      </div>
                      <p className="text-xs text-offblack/40">minutes · seconds</p>
                    </div>

                    <div className="w-full border-t border-black/8 pt-4 flex items-baseline justify-between">
                      <span className="text-sm text-offblack/60">
                        ₱{selectedType.price.toLocaleString()} × {quantity}
                      </span>
                      <span className="text-2xl font-black text-offblack">
                        ₱{total.toLocaleString()}
                      </span>
                    </div>

                    <a
                      href={reservation.checkoutUrl}
                      className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-center"
                    >
                      Continue to Payment →
                    </a>

                    <p className="text-center text-xs text-offblack/30">
                      Powered by Maya · Secure checkout
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Checkout form ── */}
          {selectedType && !reservation && (
            <form
              onSubmit={handleSubmit}
              noValidate
              className="rounded-2xl bg-white border border-black/8 shadow-sm overflow-hidden animate-fade-in-up"
            >
              {/* Order summary header */}
              <div className="bg-primary px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-0.5">
                  Order Summary
                </p>
                <p className="text-white font-black text-lg leading-tight">
                  {selectedType.name}
                </p>
                <p className="text-white/70 text-sm">
                  {game.description}
                </p>
              </div>

              <div className="px-5 py-5 flex flex-col gap-5">
                {/* Quantity */}
                <div>
                  <label className="field-label">Quantity</label>
                  <div className="flex items-center gap-3 mt-1.5">
                    <button
                      type="button"
                      onClick={() => changeQty(-1)}
                      disabled={quantity <= 1}
                      className="qty-btn"
                    >
                      −
                    </button>
                    <span className="text-xl font-black w-8 text-center tabular-nums">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => changeQty(1)}
                      disabled={quantity >= maxQty}
                      className="qty-btn"
                    >
                      +
                    </button>
                    <span className="text-xs text-offblack/40 ml-1">
                      max {maxQty}
                    </span>
                  </div>
                </div>

                {/* Total */}
                <div className="flex items-baseline justify-between border-y border-black/8 py-3">
                  <span className="text-sm text-offblack/60">
                    ₱{selectedType.price.toLocaleString()} × {quantity}
                  </span>
                  <span className="text-2xl font-black text-offblack">
                    ₱{total.toLocaleString()}
                  </span>
                </div>

                {/* Email */}
                <Field
                  label="Email"
                  required
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                  error={errors.email}
                />

                {/* Phone */}
                <Field
                  label="Phone"
                  required
                  type="tel"
                  placeholder="09171234567"
                  value={form.phone}
                  onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                  error={errors.phone}
                  hint="Philippine mobile number"
                />

                {/* Name */}
                <Field
                  label="Name"
                  type="text"
                  placeholder="Juan dela Cruz"
                  value={form.name}
                  onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                  optional
                />

                {/* API error */}
                {apiError && (
                  <p className="text-sm text-danger font-medium bg-danger/5 rounded-lg px-3 py-2">
                    {apiError}
                  </p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || overLimit}
                  className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed
                    text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Reserving your tickets…
                    </>
                  ) : (
                    'Proceed to Payment →'
                  )}
                </button>

                <p className="text-center text-xs text-offblack/30">
                  Powered by Maya · Secure checkout
                </p>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Sub-component: labelled form field ──────────────────────────────────────

interface FieldProps {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  optional?: boolean;
  error?: string;
  hint?: string;
}

function Field({ label, type, placeholder, value, onChange, required, optional, error, hint }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-1">
        <label className="text-xs font-semibold text-offblack/70 uppercase tracking-wide">
          {label}
        </label>
        {required && <span className="text-danger text-xs">*</span>}
        {optional && <span className="text-offblack/30 text-xs">(optional)</span>}
      </div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border px-3 py-2.5 text-sm bg-offwhite/50 text-offblack placeholder:text-offblack/25
          focus:outline-none focus:ring-2 focus:bg-white transition-all
          ${error
            ? 'border-danger focus:ring-danger/20'
            : 'border-black/12 focus:ring-primary/20 focus:border-primary/50'
          }`}
      />
      {hint && !error && <p className="text-[11px] text-offblack/35">{hint}</p>}
      {error && <p className="text-[11px] text-danger font-medium">{error}</p>}
    </div>
  );
}
