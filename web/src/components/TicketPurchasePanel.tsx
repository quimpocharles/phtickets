'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
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
  country: string;
}

interface Reservation {
  checkoutUrl: string;
  expiresAt: string;
}

const COUNTRIES = [
  { code: 'PH', label: 'Philippines',      flag: '🇵🇭' },
  { code: 'US', label: 'United States',    flag: '🇺🇸' },
  { code: 'AU', label: 'Australia',        flag: '🇦🇺' },
  { code: 'CA', label: 'Canada',           flag: '🇨🇦' },
  { code: 'NZ', label: 'New Zealand',      flag: '🇳🇿' },
  { code: 'IT', label: 'Italy',            flag: '🇮🇹' },
  { code: 'EU', label: 'European Union',   flag: '🇪🇺' },
  { code: 'GB', label: 'United Kingdom',   flag: '🇬🇧' },
  { code: 'AE', label: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'JP', label: 'Japan',            flag: '🇯🇵' },
] as const;

const EMPTY_FORM: FormState = { email: '', phone: '', name: '', country: '' };

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

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
    setAgreedToTerms(false);
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
    if (!form.name.trim()) {
      next.name = 'Name is required.';
    }
    if (!form.phone.trim()) {
      next.phone = 'Phone number is required.';
    } else if (!/^\+?[\d\s\-().]{7,20}$/.test(form.phone.trim())) {
      next.phone = 'Enter a valid phone number (e.g. +1 555 123 4567 or 09171234567).';
    }
    if (!form.country) {
      next.country = 'Please select your country.';
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
        country: form.country || undefined,
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

  // ── Order summary panel — shared between desktop column and mobile drawer ──
  const orderPanel = (
    <div className="md:sticky md:top-6">

      {/* ── No ticket selected ── */}
      {!selectedType && (
        <div className="rounded-2xl border-2 border-dashed border-black/15 p-8 flex flex-col items-center justify-center text-center gap-2 min-h-[220px]">
          <div className="w-10 h-10 rounded-full bg-black/8 flex items-center justify-center mb-1">
            <svg className="w-5 h-5 text-offblack/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <div className="px-5 py-4 bg-offblack">
            <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-0.5">
              {expired ? 'Reservation Expired' : 'Reservation Confirmed'}
            </p>
            <p className="text-white font-black text-lg leading-tight">
              {expired ? 'Your hold has ended' : 'Tickets reserved for you'}
            </p>
            <p className="text-white/70 text-sm">
              {selectedType.name} · {quantity} ticket{quantity > 1 ? 's' : ''}
            </p>
            {form.country && (() => {
              const c = COUNTRIES.find((x) => x.code === form.country);
              return c ? (
                <p className="text-white/50 text-xs mt-0.5">{c.flag} {c.label}</p>
              ) : null;
            })()}
          </div>

          <div className="px-5 py-6 flex flex-col items-center gap-5">
            {expired ? (
              <>
                <div className="text-center">
                  <p className="text-sm text-offblack/60 mb-1">Your reserved seats have been released.</p>
                  <p className="text-xs text-offblack/40">Availability has been refreshed — please select again.</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setReservation(null); setSelectedType(null); setDrawerOpen(false); }}
                  className="w-full bg-offblack hover:bg-black text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98]"
                >
                  Choose Tickets Again
                </button>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-offblack/40">Time remaining</p>
                  <div className="flex items-center gap-1 tabular-nums">
                    <span className="text-5xl font-black text-offblack">{mins}</span>
                    <span className="text-3xl font-black text-offblack/30 mb-1">:</span>
                    <span className="text-5xl font-black text-offblack">{secs}</span>
                  </div>
                  <p className="text-xs text-offblack/40">minutes · seconds</p>
                </div>

                <div className="w-full border-t border-black/8 pt-4 flex items-baseline justify-between">
                  <span className="text-sm text-offblack/60">₱{selectedType.price.toLocaleString()} × {quantity}</span>
                  <span className="text-2xl font-black text-offblack">₱{total.toLocaleString()}</span>
                </div>

                <a
                  href={reservation.checkoutUrl}
                  className="w-full bg-offblack hover:bg-black text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-center"
                >
                  Continue to Payment →
                </a>

                <div className="text-center space-y-1">
              <p className="text-xs text-offblack/30">Powered by Maya · Secure checkout</p>
              <p className="text-xs text-offblack/40">Visa · Mastercard · JCB · Amex · QR Ph accepted</p>
              <p className="text-xs text-offblack/30">
                By proceeding you agree to our{' '}
                <a href="/legal" className="underline hover:text-primary transition-colors">Terms &amp; Privacy</a>
              </p>
            </div>
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
          <div className="bg-offblack px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-0.5">Order Summary</p>
            <p className="text-white font-black text-lg leading-tight">{selectedType.name.toUpperCase()}</p>
            <p className="text-white/70 text-sm">{game.description}</p>
          </div>

          <div className="px-5 py-5 flex flex-col gap-5">
            {/* Quantity */}
            <div>
              <label className="field-label">Quantity</label>
              <div className="flex items-center gap-3 mt-1.5">
                <button type="button" onClick={() => changeQty(-1)} disabled={quantity <= 1} className="qty-btn">−</button>
                <span className="text-xl font-black w-8 text-center tabular-nums">{quantity}</span>
                <button type="button" onClick={() => changeQty(1)} disabled={quantity >= maxQty} className="qty-btn">+</button>
                <span className="text-xs text-offblack/40 ml-1">max {maxQty}</span>
              </div>
            </div>

            {/* Total */}
            <div className="flex items-baseline justify-between border-y border-black/8 py-3">
              <span className="text-sm text-offblack/60">₱{selectedType.price.toLocaleString()} × {quantity}</span>
              <span className="text-2xl font-black text-offblack">₱{total.toLocaleString()}</span>
            </div>

            <Field label="Email" required type="email" placeholder="you@example.com"
              value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} error={errors.email} />

            <Field label="Phone" required type="tel" placeholder="+1 555 123 4567 or 09171234567"
              value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
              error={errors.phone} hint="Include country code for international numbers" />

            <Field label="Name" required type="text" placeholder="Juan dela Cruz"
              value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} error={errors.name} />

            {/* Country selector */}
            <div>
              <label className="text-xs font-semibold text-offblack/70 uppercase tracking-wide">
                Country <span className="text-danger">*</span>
              </label>
              <p className="text-xs text-offblack/40 mt-0.5 mb-1.5">
                Which country are you representing / supporting?
              </p>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {COUNTRIES.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, country: c.code }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all
                      ${form.country === c.code
                        ? 'border-offblack bg-offblack text-white'
                        : 'border-black/10 bg-white hover:border-offblack/30 text-offblack'
                      }`}
                  >
                    <span className="text-xl leading-none">{c.flag}</span>
                    <span className="text-xs font-semibold leading-tight">{c.label}</span>
                  </button>
                ))}
              </div>
              {errors.country && (
                <p className="text-xs text-danger mt-1.5">{errors.country}</p>
              )}
            </div>

            {apiError && (
              <p className="text-sm text-danger font-medium bg-danger/5 rounded-lg px-3 py-2">{apiError}</p>
            )}

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 rounded border-black/20 text-primary accent-primary cursor-pointer"
              />
              <span className="text-xs text-offblack/50 leading-relaxed">
                I agree to the{' '}
                <a
                  href="/legal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-primary transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  Terms &amp; Privacy Policy
                </a>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || overLimit || !agreedToTerms}
              className="w-full bg-offblack hover:bg-black disabled:opacity-60 disabled:cursor-not-allowed
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

            <div className="text-center space-y-1">
              <p className="text-xs text-offblack/30">Powered by Maya · Secure checkout</p>
              <p className="text-xs text-offblack/40">Visa · Mastercard · JCB · Amex · QR Ph accepted</p>
            </div>
          </div>
        </form>
      )}
    </div>
  );

  const TZ = 'Asia/Manila';
  const gameDate = new Date(game.gameDate);
  const endDate  = new Date(game.eventEndDate);
  const dayKey   = (d: Date) => d.toLocaleDateString('en-PH', { timeZone: TZ });
  const sameDay  = dayKey(gameDate) === dayKey(endDate);
  const dateStr    = gameDate.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: TZ });
  const timeStr    = gameDate.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
  const endDateStr = endDate.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: TZ });

  return (
    <>
      {/* Game details card — full width on desktop, compact with image on mobile */}
      <div className="mb-6 rounded-2xl bg-offblack overflow-hidden inline-flex md:flex items-stretch w-auto md:w-full">
        <div className="p-4 flex flex-col gap-3 flex-1">
          <h2 className="font-black uppercase text-white text-base leading-tight">{game.description}</h2>
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex items-center gap-2 text-white/60">
              <svg className="w-4 h-4 shrink-0 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{sameDay ? `${dateStr} · ${timeStr}` : `${dateStr} – ${endDateStr}`}</span>
            </div>
            <div className="flex items-center gap-2 text-white/60">
              <svg className="w-4 h-4 shrink-0 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{game.venue}</span>
            </div>
          </div>
        </div>
        {/* Image — mobile only */}
        <div className="md:hidden relative w-28 shrink-0">
          <Image src="/smart-gh.jpg" alt="Smart x Global Hoops" fill className="object-cover" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-10">
        {/* Left — Ticket type selection */}
        <div className="md:col-span-3">
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
                  onClick={() => { selectType(tt); }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right — Desktop / tablet order summary */}
        <div className="hidden md:block md:col-span-2">
          {orderPanel}
        </div>
      </div>

      {/* ── Mobile: hamburger trigger ── */}
      <button
        type="button"
        aria-label="Open order summary"
        onClick={() => setDrawerOpen(true)}
        className="md:hidden fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        {selectedType && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent text-[9px] font-black text-offblack flex items-center justify-center">
            1
          </span>
        )}
      </button>

      {/* ── Mobile: drawer overlay ── */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile: drawer panel ── */}
      <div
        className={`md:hidden fixed inset-y-0 right-0 w-full max-w-sm bg-gray-50 z-50 shadow-2xl flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 bg-white shrink-0">
          <p className="font-black text-sm uppercase tracking-wide text-offblack">Order Summary</p>
          <button
            type="button"
            aria-label="Close order summary"
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/8 transition-colors"
          >
            <svg className="w-4 h-4 text-offblack" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer body — scrollable */}
        <div className="flex-1 overflow-y-auto p-5">
          {orderPanel}
        </div>
      </div>
    </>
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
