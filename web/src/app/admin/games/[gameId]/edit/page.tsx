'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';

interface Game {
  _id: string;
  description: string;
  venue: string;
  gameDate: string;
  eventEndDate: string;
  bannerImage: string | null;
}

interface FormErrors {
  description?: string;
  venue?: string;
  gameDate?: string;
  eventEndDate?: string;
}

// Format an ISO date string to the value needed by datetime-local input
function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditGamePage() {
  const router            = useRouter();
  const { gameId }        = useParams<{ gameId: string }>();
  const fileInputRef      = useRef<HTMLInputElement>(null);
  const API_URL           = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

  const [game, setGame]           = useState<Game | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [description, setDescription]         = useState('');
  const [venue, setVenue]                     = useState('');
  const [gameDate, setGameDate]               = useState('');
  const [eventEndDate, setEventEndDate]       = useState('');
  const [bannerFile, setBannerFile]           = useState<File | null>(null);
  const [bannerPreview, setBannerPreview]     = useState<string | null>(null);
  const [removeBannerFlag, setRemoveBannerFlag] = useState(false);

  const [errors, setErrors]     = useState<FormErrors>({});
  const [saving, setSaving]     = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Load game
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) { router.replace('/admin/login'); return; }

    fetch(`${API_URL}/admin/games`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((gamesJson) => {
        if (!gamesJson.success) throw new Error(gamesJson.message);

        const found: Game | undefined = gamesJson.data.find((g: Game) => g._id === gameId);
        if (!found) throw new Error('Game not found.');

        setGame(found);
        setDescription(found.description);
        setVenue(found.venue);
        setGameDate(toDatetimeLocal(found.gameDate));
        setEventEndDate(found.eventEndDate.slice(0, 10)); // YYYY-MM-DD for date input
        setBannerPreview(found.bannerImage ?? null);
      })
      .catch((err) => setPageError(err.message))
      .finally(() => setPageLoading(false));
  }, [API_URL, gameId, router]);

  function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setBannerFile(file);
    setRemoveBannerFlag(false);
    setBannerPreview(file ? URL.createObjectURL(file) : (game?.bannerImage ?? null));
  }

  function handleRemoveBanner() {
    setBannerFile(null);
    setBannerPreview(null);
    setRemoveBannerFlag(true);
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

    setSaving(true);
    setApiError(null);

    const token = localStorage.getItem('adminToken');
    const body  = new FormData();
    body.append('description',  description.trim());
    body.append('venue',        venue.trim());
    body.append('gameDate',     new Date(gameDate).toISOString());
    body.append('eventEndDate', new Date(eventEndDate).toISOString());
    if (bannerFile)        body.append('bannerImage', bannerFile);
    if (removeBannerFlag)  body.append('removeBanner', 'true');

    try {
      const res  = await fetch(`${API_URL}/admin/games/${gameId}`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const json = await res.json();

      if (res.status === 401) { localStorage.removeItem('adminToken'); router.replace('/admin/login'); return; }
      if (!res.ok) { setApiError(json.message ?? 'Failed to update game.'); return; }

      router.push('/admin');
    } catch {
      setApiError('Could not reach the server. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="flex items-center justify-center py-32 px-4">
        <div className="text-center">
          <p className="text-danger font-semibold mb-2">Failed to load game</p>
          <p className="text-sm text-offblack/50 mb-4">{pageError}</p>
          <a href="/admin" className="text-primary text-sm font-bold hover:underline">← Back to dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-offblack">Edit Game</h1>
        <p className="text-sm text-offblack/50 mt-1">{game?.description}</p>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="bg-white rounded-2xl border border-black/8 shadow-sm overflow-hidden"
      >
        <div className="bg-primary px-6 py-4">
          <p className="text-white font-bold text-sm">Game Details</p>
          <p className="text-white/60 text-xs mt-0.5">Update any fields below. Leave banner empty to keep the existing one.</p>
        </div>

        <div className="px-6 py-6 flex flex-col gap-6">

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-offblack/70 uppercase tracking-wide">
              Description <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Letran vs San Beda | EAC vs Mapua"
              value={description}
              onChange={(e) => { setDescription(e.target.value); setErrors((err) => ({ ...err, description: undefined })); }}
              className={`w-full rounded-lg border px-3 py-2.5 text-sm bg-offwhite/50 text-offblack
                placeholder:text-offblack/25 focus:outline-none focus:ring-2 focus:bg-white transition-all
                ${errors.description ? 'border-danger focus:ring-danger/20' : 'border-black/12 focus:ring-primary/20 focus:border-primary/50'}`}
            />
            {errors.description && <p className="text-[11px] text-danger font-medium">{errors.description}</p>}
          </div>

          {/* Venue */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-offblack/70 uppercase tracking-wide">
              Venue <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Araneta Coliseum"
              value={venue}
              onChange={(e) => { setVenue(e.target.value); setErrors((err) => ({ ...err, venue: undefined })); }}
              className={`w-full rounded-lg border px-3 py-2.5 text-sm bg-offwhite/50 text-offblack
                placeholder:text-offblack/25 focus:outline-none focus:ring-2 focus:bg-white transition-all
                ${errors.venue ? 'border-danger focus:ring-danger/20' : 'border-black/12 focus:ring-primary/20 focus:border-primary/50'}`}
            />
            {errors.venue && <p className="text-[11px] text-danger font-medium">{errors.venue}</p>}
          </div>

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
                  ${errors.gameDate ? 'border-danger focus:ring-danger/20' : 'border-black/12 focus:ring-primary/20 focus:border-primary/50'}`}
              />
              {errors.gameDate && <p className="text-[11px] text-danger font-medium">{errors.gameDate}</p>}
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
                  ${errors.eventEndDate ? 'border-danger focus:ring-danger/20' : 'border-black/12 focus:ring-primary/20 focus:border-primary/50'}`}
              />
              {errors.eventEndDate && <p className="text-[11px] text-danger font-medium">{errors.eventEndDate}</p>}
            </div>
          </div>

          {/* Banner image */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-offblack/70 uppercase tracking-wide">
              Banner Image <span className="text-offblack/30 font-normal normal-case">(optional — leave unchanged to keep existing)</span>
            </label>

            {bannerPreview ? (
              <div className="relative rounded-xl overflow-hidden border border-black/10 aspect-[3/1]">
                <Image src={bannerPreview} alt="Banner preview" fill className="object-cover" />
                <div className="absolute top-2 right-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-black/60 hover:bg-black/80 text-white rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveBanner}
                    className="bg-danger/80 hover:bg-danger text-white rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors"
                  >
                    Remove
                  </button>
                </div>
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

          {apiError && (
            <p className="text-sm text-danger font-medium bg-danger/5 rounded-lg px-3 py-2">{apiError}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <a
              href="/admin"
              className="flex-1 text-center border border-black/12 text-offblack/60 hover:text-offblack font-semibold py-3.5 rounded-xl transition-all text-sm"
            >
              Cancel
            </a>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed
                text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98]
                flex items-center justify-center gap-2"
            >
              {saving ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
              ) : (
                'Save Changes →'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
