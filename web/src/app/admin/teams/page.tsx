'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface Team {
  _id: string;
  name: string;
  monicker: string | null;
  logo: string | null;
}

type Mode = { type: 'idle' } | { type: 'add' } | { type: 'edit'; team: Team };

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams]     = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [mode, setMode]       = useState<Mode>({ type: 'idle' });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

  const fetchTeams = useCallback(async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) { router.replace('/admin/login'); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/admin/teams`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { localStorage.removeItem('adminToken'); router.replace('/admin/login'); return; }
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setTeams(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams.');
    } finally {
      setLoading(false);
    }
  }, [API_URL, router]);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  async function handleDelete(id: string) {
    setDeleting(true);
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`${API_URL}/admin/teams/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setTeams((prev) => prev.filter((t) => t._id !== id));
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  }

  function onSaved(team: Team, isNew: boolean) {
    if (isNew) {
      setTeams((prev) => [...prev, team].sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      setTeams((prev) => prev.map((t) => t._id === team._id ? team : t));
    }
    setMode({ type: 'idle' });
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-black text-offblack">Teams</h1>
          <p className="text-sm text-offblack/40 mt-1">
            {teams.length} team{teams.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        {mode.type === 'idle' && (
          <button
            onClick={() => setMode({ type: 'add' })}
            className="bg-primary hover:bg-primary/90 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all active:scale-[0.98]"
          >
            + Add Team
          </button>
        )}
      </div>

      {/* Add / Edit form */}
      {mode.type !== 'idle' && (
        <div className="mb-6">
          <TeamForm
            initial={mode.type === 'edit' ? mode.team : null}
            onSaved={onSaved}
            onCancel={() => setMode({ type: 'idle' })}
            apiUrl={API_URL}
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-danger font-semibold mb-2">Failed to load teams</p>
          <p className="text-sm text-offblack/50 mb-4">{error}</p>
          <button onClick={fetchTeams} className="text-primary text-sm font-bold hover:underline">Try again</button>
        </div>
      ) : teams.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm px-6 py-16 text-center">
          <p className="text-offblack/40 text-sm mb-3">No teams yet.</p>
          {mode.type === 'idle' && (
            <button
              onClick={() => setMode({ type: 'add' })}
              className="text-primary text-sm font-bold hover:underline"
            >
              + Add your first team
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm overflow-hidden">
          <ul className="divide-y divide-black/5">
            {teams.map((team) => {
              const isEditing    = mode.type === 'edit' && mode.team._id === team._id;
              const isConfirming = confirmDeleteId === team._id;

              return (
                <li key={team._id} className="px-5 py-4 flex items-center gap-4 hover:bg-offwhite/40 transition-colors">
                  {/* Logo */}
                  {team.logo ? (
                    <Image
                      src={team.logo}
                      alt={team.name}
                      width={40}
                      height={40}
                      className="rounded-full object-cover shrink-0 border border-black/8"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-black text-primary">{team.name.charAt(0)}</span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-offblack text-sm">{team.name}</p>
                    {team.monicker && (
                      <p className="text-xs text-offblack/40 mt-0.5">{team.monicker}</p>
                    )}
                  </div>

                  {/* Actions */}
                  {isConfirming ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-offblack/50">Delete?</span>
                      <button
                        onClick={() => handleDelete(team._id)}
                        disabled={deleting}
                        className="text-xs font-bold text-white bg-danger hover:bg-danger/80 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {deleting ? '…' : 'Yes'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={deleting}
                        className="text-xs font-bold text-offblack/60 hover:text-offblack border border-black/12 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => setMode(isEditing ? { type: 'idle' } : { type: 'edit', team })}
                        className={`text-xs font-bold transition-colors ${isEditing ? 'text-primary' : 'text-offblack/40 hover:text-offblack'}`}
                      >
                        {isEditing ? 'Cancel' : 'Edit'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(team._id)}
                        className="text-xs font-bold text-danger/50 hover:text-danger transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Team form (add + edit) ─────────────────────────────────────────────────────

interface TeamFormProps {
  initial: Team | null;
  onSaved: (team: Team, isNew: boolean) => void;
  onCancel: () => void;
  apiUrl: string;
}

function TeamForm({ initial, onSaved, onCancel, apiUrl }: TeamFormProps) {
  const isEdit = initial !== null;
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName]         = useState(initial?.name ?? '');
  const [monicker, setMonicker] = useState(initial?.monicker ?? '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(initial?.logo ?? null);
  const [saving, setSaving]     = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errors, setErrors]     = useState<{ name?: string }>({});

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setLogoFile(file);
    setPreview(file ? URL.createObjectURL(file) : (initial?.logo ?? null));
  }

  function validate() {
    const next: { name?: string } = {};
    if (!name.trim()) next.name = 'Team name is required.';
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
    body.append('name', name.trim());
    body.append('monicker', monicker.trim());
    if (logoFile) body.append('logo', logoFile);

    const url    = isEdit ? `${apiUrl}/admin/teams/${initial!._id}` : `${apiUrl}/admin/teams`;
    const method = isEdit ? 'PATCH' : 'POST';

    try {
      const res  = await fetch(url, { method, headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }, body });
      const json = await res.json();
      if (!res.ok) { setApiError(json.message ?? 'Something went wrong.'); return; }
      onSaved(json.data, !isEdit);
    } catch {
      setApiError('Could not reach the server.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-white rounded-2xl border border-primary/20 shadow-sm overflow-hidden"
    >
      <div className="bg-primary px-5 py-3.5">
        <p className="text-white font-bold text-sm">{isEdit ? `Edit — ${initial!.name}` : 'Add New Team'}</p>
      </div>

      <div className="px-5 py-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-offblack/70 uppercase tracking-wide">
              Team Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Magnolia Chicken Timplados"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors({}); }}
              className={`w-full rounded-lg border px-3 py-2.5 text-sm bg-offwhite/50 text-offblack
                placeholder:text-offblack/25 focus:outline-none focus:ring-2 focus:bg-white transition-all
                ${errors.name ? 'border-danger focus:ring-danger/20' : 'border-black/12 focus:ring-primary/20 focus:border-primary/50'}`}
            />
            {errors.name && <p className="text-[11px] text-danger font-medium">{errors.name}</p>}
          </div>

          {/* Monicker */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-offblack/70 uppercase tracking-wide">
              Monicker <span className="text-offblack/30 font-normal normal-case">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Hotshots"
              value={monicker}
              onChange={(e) => setMonicker(e.target.value)}
              className="w-full rounded-lg border border-black/12 px-3 py-2.5 text-sm bg-offwhite/50 text-offblack
                placeholder:text-offblack/25 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Logo */}
        <div className="flex items-center gap-4">
          {/* Preview */}
          <div className="shrink-0">
            {preview ? (
              <Image
                src={preview}
                alt="Logo preview"
                width={56}
                height={56}
                className="rounded-full object-cover border border-black/10"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-offwhite border-2 border-dashed border-black/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-offblack/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <label className="text-xs font-semibold text-offblack/70 uppercase tracking-wide">
              Team Logo <span className="text-offblack/30 font-normal normal-case">(optional · square image recommended)</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-xs font-bold text-primary border border-primary/30 hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors"
              >
                {logoFile ? 'Change' : preview ? 'Replace' : 'Upload'}
              </button>
              {(logoFile || preview) && (
                <button
                  type="button"
                  onClick={() => { setLogoFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                  className="text-xs font-bold text-offblack/40 hover:text-danger transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpg,image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {apiError && (
          <p className="text-sm text-danger font-medium bg-danger/5 rounded-lg px-3 py-2">{apiError}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-black/12 text-offblack/60 hover:text-offblack font-semibold py-3 rounded-xl text-sm transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{isEdit ? 'Saving…' : 'Adding…'}</>
            ) : (
              isEdit ? 'Save Changes' : 'Add Team'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
