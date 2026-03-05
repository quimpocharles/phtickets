'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface FormErrors {
  description?: string;
  venue?: string;
  gameDate?: string;
  eventEndDate?: string;
}

export default function NewGameForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [description, setDescription]   = useState('');
  const [venue, setVenue]               = useState('');
  const [gameDate, setGameDate]         = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [errors, setErrors]           = useState<FormErrors>({});
  const [bannerFile, setBannerFile]   = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [apiError, setApiError]       = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

  // Auth guard
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) { router.replace('/admin/login'); return; }
  }, [router]);

  function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setBannerFile(file);
    setBannerPreview(file ? URL.createObjectURL(file) : null);
  }

  function removeBanner() {
    setBannerFile(null);
    setBannerPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (!description.trim()) next.description = 'Description is required.';
    if (!venue.trim())       next.venue        = 'Venue is required.';
    if (!gameDate)           next.gameDate     = 'Game date is required.';
    if (!eventEndDate)       next.eventEndDate = 'Event end date is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setApiError(null);

    const token = localStorage.getItem('adminToken');

    const body = new FormData();
    body.append('description',  description.trim());
    body.append('venue',        venue.trim());
    body.append('gameDate',     new Date(gameDate).toISOString());
    body.append('eventEndDate', new Date(eventEndDate).toISOString());
    if (bannerFile) body.append('bannerImage', bannerFile);

    try {
      const res = await fetch(`${API_URL}/admin/games`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      });

      const json = await res.json();

      if (res.status === 401) {
        localStorage.removeItem('adminToken');
        router.replace('/admin/login');
        return;
      }

      if (!res.ok) {
        setApiError(json.message ?? 'Failed to create game.');
        return;
      }

      router.push('/admin');
    } catch {
      setApiError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-white rounded-2xl border border-black/8 shadow-sm overflow-hidden"
    >
      <div className="bg-primary px-6 py-4">
        <p className="text-white font-bold text-sm">Game Details</p>
        <p className="text-white/60 text-xs mt-0.5">All fields except banner image are required.</p>
      </div>

      <div className="px-6 py-6 flex flex-col gap-6">

        {/* Description */}
        <Field
          label="Description"
          placeholder="e.g. Letran vs San Beda | EAC vs Mapua"
          value={description}
          onChange={(v) => { setDescription(v); setErrors((e) => ({ ...e, description: undefined })); }}
          error={errors.description}
        />

        {/* Venue */}
        <Field
          label="Venue"
          placeholder="e.g. Araneta Coliseum"
          value={venue}
          onChange={(v) => { setVenue(v); setErrors((e) => ({ ...e, venue: undefined })); }}
          error={errors.venue}
        />

        {/* Event date range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-offblack/70 uppercase tracking-wide">
              Event Start <span className="text-danger">*</span>
            </label>
            <input
              type="datetime-local"
              value={gameDate}
              onChange={(e) => { setGameDate(e.target.value); setErrors((err) => ({ ...err, gameDate: undefined })); }}
              className={`w-full rounded-lg border px-3 py-2.5 text-sm bg-offwhite/50 text-offblack
                focus:outline-none focus:ring-2 focus:bg-white transition-all
                ${errors.gameDate
                  ? 'border-danger focus:ring-danger/20'
                  : 'border-black/12 focus:ring-primary/20 focus:border-primary/50'
                }`}
            />
            {errors.gameDate && (
              <p className="text-[11px] text-danger font-medium">{errors.gameDate}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-offblack/70 uppercase tracking-wide">
              Event End <span className="text-danger">*</span>
            </label>
            <input
              type="date"
              value={eventEndDate}
              onChange={(e) => { setEventEndDate(e.target.value); setErrors((err) => ({ ...err, eventEndDate: undefined })); }}
              className={`w-full rounded-lg border px-3 py-2.5 text-sm bg-offwhite/50 text-offblack
                focus:outline-none focus:ring-2 focus:bg-white transition-all
                ${errors.eventEndDate
                  ? 'border-danger focus:ring-danger/20'
                  : 'border-black/12 focus:ring-primary/20 focus:border-primary/50'
                }`}
            />
            {errors.eventEndDate && (
              <p className="text-[11px] text-danger font-medium">{errors.eventEndDate}</p>
            )}
          </div>
        </div>

        {/* Banner image */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-offblack/70 uppercase tracking-wide">
            Banner Image <span className="text-offblack/30 font-normal normal-case">(optional)</span>
          </label>

          {bannerPreview ? (
            <div className="relative rounded-xl overflow-hidden border border-black/10 aspect-[3/1]">
              <Image src={bannerPreview} alt="Banner preview" fill className="object-cover" />
              <button
                type="button"
                onClick={removeBanner}
                className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-black/15 hover:border-primary/40 rounded-xl p-8
                flex flex-col items-center justify-center gap-2 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-primary/8 group-hover:bg-primary/12 flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-primary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-offblack/50 group-hover:text-offblack/70 transition-colors">
                Click to upload banner
              </p>
              <p className="text-xs text-offblack/30">JPG, PNG or WebP · Recommended 1200×400</p>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpg,image/jpeg,image/png,image/webp"
            onChange={handleBannerChange}
            className="hidden"
          />
        </div>

        {/* API error */}
        {apiError && (
          <p className="text-sm text-danger font-medium bg-danger/5 rounded-lg px-3 py-2">
            {apiError}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <a
            href="/admin"
            className="flex-1 text-center border border-black/12 text-offblack/60 hover:text-offblack font-semibold
              py-3.5 rounded-xl transition-all text-sm"
          >
            Cancel
          </a>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed
              text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98]
              flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating…
              </>
            ) : (
              'Create Game →'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Field sub-component ────────────────────────────────────────────────────────

function Field({ label, placeholder, value, onChange, error }: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-offblack/70 uppercase tracking-wide">
        {label} <span className="text-danger">*</span>
      </label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border px-3 py-2.5 text-sm bg-offwhite/50 text-offblack
          placeholder:text-offblack/25 focus:outline-none focus:ring-2 focus:bg-white transition-all
          ${error
            ? 'border-danger focus:ring-danger/20'
            : 'border-black/12 focus:ring-primary/20 focus:border-primary/50'
          }`}
      />
      {error && <p className="text-[11px] text-danger font-medium">{error}</p>}
    </div>
  );
}
