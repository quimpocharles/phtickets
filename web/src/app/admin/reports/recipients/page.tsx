'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Recipient {
  _id: string;
  email: string;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function ReportRecipientsPage() {
  const router = useRouter();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [email, setEmail]           = useState('');
  const [adding, setAdding]         = useState(false);
  const [addError, setAddError]     = useState<string | null>(null);
  const [confirmId, setConfirmId]   = useState<string | null>(null);
  const [deleting, setDeleting]     = useState(false);

  const fetchRecipients = useCallback(async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) { router.replace('/admin/login'); return; }

    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API_URL}/admin/report-recipients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { localStorage.removeItem('adminToken'); router.replace('/admin/login'); return; }
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setRecipients(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipients.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchRecipients(); }, [fetchRecipients]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setAdding(true);
    setAddError(null);
    const token = localStorage.getItem('adminToken');

    try {
      const res  = await fetch(`${API_URL}/admin/report-recipients`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) { setAddError(json.message ?? 'Failed to add recipient.'); return; }
      setRecipients((prev) => [...prev, json.data]);
      setEmail('');
    } catch {
      setAddError('Could not reach the server. Please try again.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    const token = localStorage.getItem('adminToken');

    try {
      const res  = await fetch(`${API_URL}/admin/report-recipients/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      setRecipients((prev) => prev.filter((r) => r._id !== id));
    } catch {
      // ignore
    } finally {
      setDeleting(false);
      setConfirmId(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">

      <div className="mb-6">
        <h1 className="text-2xl font-black text-offblack">EOD Report Recipients</h1>
        <p className="text-sm text-offblack/40 mt-1">
          These email addresses receive the automatic end-of-day sales report at 11:59 PM PHT.
        </p>
      </div>

      {/* ── Add form ── */}
      <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-black/8 shadow-sm p-5 mb-6">
        <p className="text-sm font-bold text-offblack mb-3">Add Recipient</p>
        <div className="flex gap-2">
          <input
            type="email"
            required
            placeholder="email@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setAddError(null); }}
            className="flex-1 rounded-xl border border-black/12 px-3 py-2.5 text-sm bg-offwhite/50 text-offblack
              placeholder:text-offblack/25 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50
              focus:bg-white transition-all"
          />
          <button
            type="submit"
            disabled={adding || !email.trim()}
            className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed
              text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all active:scale-[0.98]
              flex items-center gap-2 shrink-0"
          >
            {adding ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : '+ Add'}
          </button>
        </div>
        {addError && (
          <p className="text-sm text-danger font-medium mt-2">{addError}</p>
        )}
      </form>

      {/* ── Recipients list ── */}
      <div className="bg-white rounded-2xl border border-black/8 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-black/8">
          <p className="font-bold text-offblack text-sm">
            {loading ? 'Loading…' : `${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <span className="w-7 h-7 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="px-5 py-8 text-center">
            <p className="text-danger font-semibold text-sm mb-2">{error}</p>
            <button onClick={fetchRecipients} className="text-primary text-sm font-bold hover:underline">
              Try again
            </button>
          </div>
        ) : recipients.length === 0 ? (
          <div className="px-5 py-12 text-center text-offblack/40 text-sm">
            No recipients yet. Add one above.
          </div>
        ) : (
          <ul className="divide-y divide-black/5">
            {recipients.map((r) => (
              <li key={r._id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-offblack">{r.email}</p>
                  <p className="text-xs text-offblack/30 mt-0.5">
                    Added {new Date(r.createdAt).toLocaleDateString('en-PH', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                </div>

                {confirmId === r._id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-offblack/50">Remove?</span>
                    <button
                      onClick={() => handleDelete(r._id)}
                      disabled={deleting}
                      className="text-xs font-bold text-white bg-danger hover:bg-danger/80 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deleting ? '…' : 'Yes'}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      disabled={deleting}
                      className="text-xs font-bold text-offblack/50 hover:text-offblack border border-black/12 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(r._id)}
                    className="text-xs font-bold text-danger/50 hover:text-danger transition-colors shrink-0"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
