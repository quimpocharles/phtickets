'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type ScanPhase = 'scanning' | 'verifying' | 'valid' | 'already_used' | 'invalid';

interface TicketData {
  ticketId: string;
  status: string;
  gameId?: { description: string; venue: string; gameDate: string };
  ticketTypeId?: { name: string; price: number };
  orderId?: { orderNumber: string; buyerName: string | null; buyerEmail: string };
}

interface ScanResult {
  phase: 'valid' | 'already_used' | 'invalid';
  message: string;
  ticket: TicketData | null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScannerPage() {
  const router          = useRouter();
  const videoRef        = useRef<HTMLVideoElement>(null);
  const isProcessingRef = useRef(false);   // blocks re-entry while verifying
  const stopCameraRef   = useRef<(() => void) | null>(null);

  const [phase,       setPhase]       = useState<ScanPhase>('scanning');
  const [scanResult,  setScanResult]  = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualId,    setManualId]    = useState('');

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!localStorage.getItem('adminToken')) {
      router.replace('/admin/login');
    }
  }, [router]);

  // ── Verify a scanned ticketId against the API ──────────────────────────────
  const verifyTicket = useCallback(async (ticketId: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setPhase('verifying');

    const token = localStorage.getItem('adminToken');
    if (!token) { router.replace('/admin/login'); return; }

    try {
      const res  = await fetch(`${API_URL}/tickets/verify/${encodeURIComponent(ticketId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) { router.replace('/admin/login'); return; }

      const json = await res.json();

      if (res.ok && json.success) {
        setScanResult({ phase: 'valid', message: json.message, ticket: json.data ?? null });
        setPhase('valid');
      } else if (res.status === 409) {
        setScanResult({ phase: 'already_used', message: json.message, ticket: json.data ?? null });
        setPhase('already_used');
      } else {
        setScanResult({ phase: 'invalid', message: json.message ?? 'Ticket not found.', ticket: null });
        setPhase('invalid');
      }
    } catch {
      setScanResult({ phase: 'invalid', message: 'Server unreachable. Check your connection.', ticket: null });
      setPhase('invalid');
    }
  }, [router]);

  // ── Start camera + ZXing on mount ─────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let mounted = true;

    async function startCamera() {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        const reader   = new BrowserQRCodeReader();
        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: 'environment' },
              width:      { ideal: 1280 },
              height:     { ideal: 720 },
            },
          },
          video!,
          (result: import('@zxing/library').Result | undefined) => {
            if (result && mounted) verifyTicket(result.getText());
          }
        );
        if (mounted) stopCameraRef.current = () => controls.stop();
      } catch (err) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : '';
        setCameraError(
          /denied|NotAllowed|Permission/i.test(msg)
            ? 'Camera access was denied. Please allow camera permission in your browser settings and reload.'
            : 'Could not start the camera. Make sure a camera is connected and try again.'
        );
      }
    }

    startCamera();
    return () => { mounted = false; stopCameraRef.current?.(); };
  }, [verifyTicket]);

  // ── Manual entry submit ────────────────────────────────────────────────────
  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = manualId.trim();
    if (!id) return;
    verifyTicket(id);
  }

  // ── Reset to scanning ──────────────────────────────────────────────────────
  function reset() {
    isProcessingRef.current = false;
    setScanResult(null);
    setPhase('scanning');
    setManualId('');
  }

  // ── Sign out ───────────────────────────────────────────────────────────────
  function handleSignOut() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminRole');
    localStorage.removeItem('adminId');
    router.replace('/admin/login');
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative h-[100dvh] bg-offblack overflow-hidden flex flex-col select-none">

      {/* ── Live camera feed ── */}
      <video
        ref={videoRef}
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* ── Dark vignette overlay ── */}
      <div className="absolute inset-0 bg-offblack/55 pointer-events-none" />

      {/* ── Scan frame ── */}
      {phase === 'scanning' && !cameraError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl"
            style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
          >
            {/* Corner brackets — accent yellow */}
            <Corner pos="tl" />
            <Corner pos="tr" />
            <Corner pos="bl" />
            <Corner pos="br" />

            {/* Scanning line */}
            <div className="absolute left-3 right-3 h-0.5 rounded-full bg-accent/80 shadow-[0_0_6px_2px_rgba(254,208,0,0.4)] animate-scan" />
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <p className="text-white font-bold text-sm leading-none">QR Scanner</p>
          <p className="text-white/40 text-xs mt-0.5">Global Hoops Ticket Verification</p>
        </div>
        <button
          onClick={handleSignOut}
          className="text-white/50 hover:text-white text-xs font-medium transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* ── Prompt / status text (mid-screen) ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-end pb-4 pointer-events-none">
        {phase === 'scanning' && !cameraError && (
          <p className="text-white/60 text-sm font-medium mb-48">Align QR code within the frame</p>
        )}
        {phase === 'verifying' && (
          <div className="flex flex-col items-center gap-3 mb-48">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-white/70 text-sm font-medium">Verifying ticket…</p>
          </div>
        )}
      </div>

      {/* ── Manual entry ── */}
      {(phase === 'scanning' || phase === 'verifying') && !cameraError && (
        <div className="relative z-10 px-4 pb-6">
          <p className="text-center text-white/30 text-[11px] font-medium uppercase tracking-widest mb-2">
            Or enter ticket ID manually
          </p>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualId}
              onChange={(e) => setManualId(e.target.value.toUpperCase())}
              placeholder="GH26-000001"
              disabled={phase === 'verifying'}
              className="flex-1 bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white text-sm font-mono
                placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/40
                disabled:opacity-40 transition-all"
            />
            <button
              type="submit"
              disabled={!manualId.trim() || phase === 'verifying'}
              className="bg-accent hover:bg-accent/90 disabled:opacity-40 text-offblack font-bold px-5 py-3
                rounded-xl transition-all active:scale-[0.97]"
            >
              →
            </button>
          </form>
        </div>
      )}

      {/* ── Camera error state ── */}
      {cameraError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-8">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 text-center max-w-xs">
            <div className="w-12 h-12 rounded-full bg-danger/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
            </div>
            <p className="text-white font-semibold text-sm mb-1">Camera Unavailable</p>
            <p className="text-white/60 text-xs leading-relaxed">{cameraError}</p>
          </div>
        </div>
      )}

      {/* ── Result panel ── */}
      {scanResult && phase !== 'scanning' && phase !== 'verifying' && (
        <ResultPanel result={scanResult} onReset={reset} />
      )}
    </div>
  );
}

// ─── Corner bracket helper ────────────────────────────────────────────────────

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base = 'absolute w-6 h-6 border-accent border-2';
  const cls = {
    tl: 'top-0 left-0  border-r-0 border-b-0 rounded-tl-lg',
    tr: 'top-0 right-0 border-l-0 border-b-0 rounded-tr-lg',
    bl: 'bottom-0 left-0  border-r-0 border-t-0 rounded-bl-lg',
    br: 'bottom-0 right-0 border-l-0 border-t-0 rounded-br-lg',
  }[pos];
  return <div className={`${base} ${cls}`} />;
}

// ─── Result panel ─────────────────────────────────────────────────────────────

interface ResultPanelProps {
  result: ScanResult;
  onReset: () => void;
}

const RESULT_CONFIG = {
  valid: {
    label:       'VALID',
    sublabel:    'Entry Granted',
    bg:          'bg-primary',
    iconBg:      'bg-white/15',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  already_used: {
    label:       'ALREADY USED',
    sublabel:    'Ticket was scanned before',
    bg:          'bg-accent',
    iconBg:      'bg-offblack/10',
    icon: (
      <svg className="w-8 h-8 text-offblack" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    ),
  },
  invalid: {
    label:       'INVALID',
    sublabel:    'Ticket not recognised',
    bg:          'bg-danger',
    iconBg:      'bg-white/15',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
} as const;

function ResultPanel({ result, onReset }: ResultPanelProps) {
  const cfg      = RESULT_CONFIG[result.phase];
  const ticket   = result.ticket;
  const isAccent = result.phase === 'already_used';
  const textCls  = isAccent ? 'text-offblack' : 'text-white';

  const gameDate = ticket?.gameId?.gameDate
    ? new Date(ticket.gameId.gameDate).toLocaleDateString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 animate-slide-up">
      {/* Coloured status header */}
      <div className={`${cfg.bg} px-5 pt-5 pb-4`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-full ${cfg.iconBg} flex items-center justify-center shrink-0`}>
            {cfg.icon}
          </div>
          <div>
            <p className={`text-2xl font-black tracking-tight leading-none ${textCls}`}>
              {cfg.label}
            </p>
            <p className={`text-sm mt-0.5 font-medium ${isAccent ? 'text-offblack/60' : 'text-white/70'}`}>
              {cfg.sublabel}
            </p>
          </div>
        </div>

        {/* Ticket ID pill */}
        {ticket?.ticketId && (
          <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${isAccent ? 'bg-offblack/10' : 'bg-white/15'}`}>
            <svg className={`w-3 h-3 ${isAccent ? 'text-offblack/50' : 'text-white/60'}`} fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2a1 1 0 01-1 1 1 1 0 100 2 1 1 0 011 1v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2a1 1 0 011-1 1 1 0 100-2 1 1 0 01-1-1V6z" />
            </svg>
            <span className={`text-xs font-mono font-bold tracking-wide ${isAccent ? 'text-offblack/70' : 'text-white/90'}`}>
              {ticket.ticketId}
            </span>
          </div>
        )}
      </div>

      {/* White details card */}
      <div className="bg-white px-5 py-4">
        {ticket?.gameId ? (
          <div className="flex flex-col gap-3 mb-5">
            {/* Game */}
            <Row
              icon={<CourtIcon />}
              label="Game"
              value={ticket.gameId.description}
            />
            {/* Date + venue */}
            {gameDate && (
              <Row
                icon={<CalIcon />}
                label="Date"
                value={`${gameDate} · ${ticket.gameId.venue}`}
              />
            )}
            {/* Ticket type */}
            {ticket.ticketTypeId && (
              <Row
                icon={<TagIcon />}
                label="Type"
                value={`${ticket.ticketTypeId.name} · ₱${ticket.ticketTypeId.price.toLocaleString()}`}
              />
            )}
            {/* Buyer */}
            {ticket.orderId && (
              <Row
                icon={<PersonIcon />}
                label="Buyer"
                value={ticket.orderId.buyerName || ticket.orderId.buyerEmail}
              />
            )}
            {/* Order */}
            {ticket.orderId && (
              <Row
                icon={<HashIcon />}
                label="Order"
                value={ticket.orderId.orderNumber}
              />
            )}
          </div>
        ) : (
          <p className="text-sm text-offblack/50 mb-5">{result.message}</p>
        )}

        <button
          onClick={onReset}
          className="w-full bg-offblack hover:bg-offblack/85 active:scale-[0.98] text-white font-bold py-3.5 rounded-xl transition-all"
        >
          Scan Next Ticket
        </button>

        <div className="h-safe-area-inset-bottom" />
      </div>
    </div>
  );
}

// ─── Detail row ───────────────────────────────────────────────────────────────

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg bg-offwhite flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-offblack/35">{label}</p>
        <p className="text-sm font-semibold text-offblack leading-snug truncate">{value}</p>
      </div>
    </div>
  );
}

// ─── Tiny icons ───────────────────────────────────────────────────────────────

const iconCls = 'w-3.5 h-3.5 text-primary/70';

function CourtIcon() {
  return (
    <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="2" x2="12" y2="22" /><path d="M7 12a5 5 0 005-5M7 12a5 5 0 015 5" />
    </svg>
  );
}
function CalIcon() {
  return (
    <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function TagIcon() {
  return (
    <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M7 7h.01M3 3h7.5a2 2 0 011.414.586l8.5 8.5a2 2 0 010 2.828l-5.086 5.086a2 2 0 01-2.828 0l-8.5-8.5A2 2 0 013 10.5V3z" />
    </svg>
  );
}
function PersonIcon() {
  return (
    <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
function HashIcon() {
  return (
    <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 9h16M4 15h16M10 3l-1 18M15 3l-1 18" />
    </svg>
  );
}
