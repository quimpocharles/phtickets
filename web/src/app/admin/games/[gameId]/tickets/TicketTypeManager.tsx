'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface TicketType {
  _id: string;
  __v: number;
  name: string;
  price: number;
  serviceFee: number;
  quantity: number;
  sold: number;
  scope: 'day' | 'all';
  ticketsPerPurchase: number;
  active: boolean;
}

interface EditForm {
  name: string;
  price: string;
  serviceFee: string;
  quantity: string;
  scope: 'day' | 'all';
  ticketsPerPurchase: string;
  __v: number;
}

interface EditErrors {
  name?: string;
  price?: string;
  serviceFee?: string;
  quantity?: string;
  ticketsPerPurchase?: string;
}

interface Game {
  _id: string;
  description: string;
  venue: string;
  gameDate: string;
  eventEndDate: string;
  ticketTypes: TicketType[];
}

interface RowForm {
  name: string;
  price: string;
  serviceFee: string;
  quantity: string;
  scope: 'day' | 'all';
  ticketsPerPurchase: string;
}

interface RowErrors {
  name?: string;
  price?: string;
  serviceFee?: string;
  quantity?: string;
  ticketsPerPurchase?: string;
}

const EMPTY_ROW: RowForm = { name: '', price: '', serviceFee: '0', quantity: '', scope: 'day', ticketsPerPurchase: '1' };

const PRESET_NAMES = [
  'Single Day Pass',
  'Family Day Pass (5 pax)',
  'VIP All Events Pass',
  'VIP Family All Events Pass (5 pax)',
];

export default function TicketTypeManager({ gameId }: { gameId: string }) {
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

  const [adminRole, setAdminRole] = useState<string>('admin');
  const [game, setGame] = useState<Game | null>(null);
  const [loadingGame, setLoadingGame] = useState(true);
  const [rows, setRows] = useState<RowForm[]>([{ ...EMPTY_ROW }]);
  const [rowErrors, setRowErrors] = useState<RowErrors[]>([{}]);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  // ── Delete state ─────────────────────────────────────────────────────────────
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(ticketTypeId: string) {
    setDeleting(true);
    setDeleteError(null);
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`${API_URL}/admin/games/${gameId}/tickets/${ticketTypeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem('adminToken');
        router.replace('/admin/login');
        return;
      }
      const json = await res.json();
      if (!res.ok) { setDeleteError(json.message ?? 'Failed to delete ticket type.'); return; }
      setConfirmDeleteId(null);
      loadGame();
    } catch {
      setDeleteError('Could not reach the server. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  // ── Edit state ───────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editErrors, setEditErrors] = useState<EditErrors>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // ── Load game data ──────────────────────────────────────────────────────────
  const loadGame = useCallback(async () => {
    setLoadingGame(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_URL}/admin/games/${gameId}/tickets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.replace('/admin/login'); return; }
      const json = await res.json();
      if (!res.ok || !json.data) { router.replace('/admin'); return; }
      setGame(json.data);
    } catch {
      router.replace('/admin');
    } finally {
      setLoadingGame(false);
    }
  }, [API_URL, gameId, router]);

  useEffect(() => {
    if (!localStorage.getItem('adminToken')) { router.replace('/admin/login'); return; }
    setAdminRole(localStorage.getItem('adminRole') ?? 'admin');
    loadGame();
  }, [loadGame, router]);

  // ── Row helpers ─────────────────────────────────────────────────────────────
  function updateRow(index: number, field: keyof RowForm, value: string) {
    setRows((prev) => prev.map((r, i) => {
      if (i !== index) return r;
      const updated = { ...r, [field]: value };
      // Auto-set ticketsPerPurchase when selecting a preset name
      if (field === 'name') {
        if (value.includes('Family') && value.includes('5 pax')) updated.ticketsPerPurchase = '5';
        else updated.ticketsPerPurchase = '1';
        // Auto-set scope based on preset
        if (value.includes('VIP') || value.includes('All Events')) updated.scope = 'all';
        else updated.scope = 'day';
      }
      return updated;
    }));
    setRowErrors((prev) => prev.map((e, i) => i === index ? { ...e, [field]: undefined } : e));
    setApiError(null);
    setSuccessCount(null);
  }

  function addRow() {
    setRows((prev) => [...prev, { ...EMPTY_ROW }]);
    setRowErrors((prev) => [...prev, {}]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setRowErrors((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Edit helpers ────────────────────────────────────────────────────────────
  function startEdit(tt: TicketType) {
    setEditingId(tt._id);
    setEditForm({
      name:               tt.name,
      price:              String(tt.price),
      serviceFee:         String(tt.serviceFee ?? 0),
      quantity:           String(tt.quantity),
      scope:              tt.scope,
      ticketsPerPurchase: String(tt.ticketsPerPurchase),
      __v:                tt.__v,
    });
    setEditErrors({});
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
    setEditErrors({});
    setEditError(null);
  }

  function updateEditField(field: keyof Omit<EditForm, '__v'>, value: string) {
    setEditForm((prev) => prev ? { ...prev, [field]: value } : prev);
    setEditErrors((prev) => ({ ...prev, [field]: undefined }));
    setEditError(null);
  }

  function validateEdit(): boolean {
    if (!editForm) return false;
    const e: EditErrors = {};
    if (!editForm.name.trim())                                                        e.name       = 'Required.';
    if (!editForm.price || isNaN(Number(editForm.price)))                             e.price      = 'Enter a valid price.';
    else if (Number(editForm.price) < 0)                                              e.price      = 'Must be 0 or more.';
    if (editForm.serviceFee === '' || isNaN(Number(editForm.serviceFee)))             e.serviceFee = 'Enter a valid fee.';
    else if (Number(editForm.serviceFee) < 0)                                         e.serviceFee = 'Must be 0 or more.';
    if (!editForm.quantity || isNaN(Number(editForm.quantity)))                       e.quantity   = 'Enter a valid number.';
    else if (!Number.isInteger(Number(editForm.quantity)) || Number(editForm.quantity) < 1)
      e.quantity = 'Must be a whole number ≥ 1.';
    if (!editForm.ticketsPerPurchase || isNaN(Number(editForm.ticketsPerPurchase)))   e.ticketsPerPurchase = 'Enter a valid number.';
    else if (!Number.isInteger(Number(editForm.ticketsPerPurchase)) || Number(editForm.ticketsPerPurchase) < 1)
      e.ticketsPerPurchase = 'Must be a whole number ≥ 1.';
    setEditErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm || !editingId) return;
    if (!validateEdit()) return;

    setEditSaving(true);
    setEditError(null);

    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`${API_URL}/admin/games/${gameId}/tickets/${editingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name:               editForm.name.trim(),
          price:              Number(editForm.price),
          serviceFee:         Number(editForm.serviceFee),
          quantity:           Number(editForm.quantity),
          scope:              editForm.scope,
          ticketsPerPurchase: Number(editForm.ticketsPerPurchase),
          __v:                editForm.__v,
        }),
      });

      if (res.status === 401) {
        localStorage.removeItem('adminToken');
        router.replace('/admin/login');
        return;
      }

      const json = await res.json();
      if (res.status === 409) { setEditError('conflict'); return; }
      if (!res.ok) { setEditError(json.message ?? 'Failed to update ticket type.'); return; }

      cancelEdit();
      loadGame();
    } catch {
      setEditError('Could not reach the server. Please try again.');
    } finally {
      setEditSaving(false);
    }
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(): boolean {
    const nextErrors = rows.map((row) => {
      const e: RowErrors = {};
      if (!row.name.trim())                                                       e.name       = 'Required.';
      if (!row.price || isNaN(Number(row.price)))                                 e.price      = 'Enter a valid price.';
      else if (Number(row.price) < 0)                                             e.price      = 'Must be 0 or more.';
      if (row.serviceFee === '' || isNaN(Number(row.serviceFee)))                 e.serviceFee = 'Enter a valid fee.';
      else if (Number(row.serviceFee) < 0)                                        e.serviceFee = 'Must be 0 or more.';
      if (!row.quantity || isNaN(Number(row.quantity)))                           e.quantity   = 'Enter a valid number.';
      else if (!Number.isInteger(Number(row.quantity)) || Number(row.quantity) < 1)
        e.quantity = 'Must be a whole number ≥ 1.';
      if (!row.ticketsPerPurchase || isNaN(Number(row.ticketsPerPurchase)))       e.ticketsPerPurchase = 'Enter a valid number.';
      else if (!Number.isInteger(Number(row.ticketsPerPurchase)) || Number(row.ticketsPerPurchase) < 1)
        e.ticketsPerPurchase = 'Must be a whole number ≥ 1.';
      return e;
    });
    setRowErrors(nextErrors);
    return nextErrors.every((e) => Object.keys(e).length === 0);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setApiError(null);
    setSuccessCount(null);

    const token = localStorage.getItem('adminToken');
    const payload = rows.map((r) => ({
      name:               r.name.trim(),
      price:              Number(r.price),
      serviceFee:         Number(r.serviceFee),
      quantity:           Number(r.quantity),
      scope:              r.scope,
      ticketsPerPurchase: Number(r.ticketsPerPurchase),
    }));

    try {
      const res = await fetch(`${API_URL}/admin/games/${gameId}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        localStorage.removeItem('adminToken');
        router.replace('/admin/login');
        return;
      }

      const json = await res.json();
      if (!res.ok) { setApiError(json.message ?? 'Failed to save ticket types.'); return; }

      setSuccessCount(json.data.length);
      setRows([{ ...EMPTY_ROW }]);
      setRowErrors([{}]);
      loadGame();
    } catch {
      setApiError('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading / not found ─────────────────────────────────────────────────────
  if (loadingGame) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!game) return null;

  const gameTitle = game.description;
  const eventEndStr = new Date(game.eventEndDate).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="flex flex-col gap-6">

      {/* Game title */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-offblack/40 mb-1">Managing tickets for</p>
        <h1 className="text-2xl font-black text-offblack">{gameTitle}</h1>
        <p className="text-sm text-offblack/50 mt-0.5">
          {game.venue} ·{' '}
          {new Date(game.gameDate).toLocaleDateString('en-PH', {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
          })}
          {' '}– {eventEndStr}
        </p>
      </div>

      {/* ── Existing ticket types ── */}
      <div className="bg-white rounded-2xl border border-black/8 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-black/8">
          <h2 className="font-bold text-offblack">Ticket Types</h2>
          <p className="text-xs text-offblack/40 mt-0.5">
            {game.ticketTypes.length === 0
              ? 'No ticket types yet.'
              : `${game.ticketTypes.length} type${game.ticketTypes.length !== 1 ? 's' : ''} created`}
          </p>
        </div>

        {game.ticketTypes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/6 bg-offwhite/60">
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">Scope</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">QRs / Purchase</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">Price</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">Svc Fee</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">Capacity</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">Sold</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {game.ticketTypes.map((tt) => (
                  <tr key={tt._id} className={`transition-colors ${!tt.active ? 'opacity-40' : editingId === tt._id ? 'bg-primary/5' : 'hover:bg-offwhite/40'}`}>
                    <td className="px-6 py-3 font-semibold text-offblack">{tt.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                        ${tt.scope === 'all'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-offwhite text-offblack/50'
                        }`}>
                        {tt.scope === 'all' ? 'All Events' : 'Day'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-offblack/70">{tt.ticketsPerPurchase}</td>
                    <td className="px-4 py-3 text-right text-offblack/70">₱{tt.price.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-offblack/70">₱{(tt.serviceFee ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-offblack/70">{tt.quantity.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={tt.sold > 0 ? 'font-semibold text-primary' : 'text-offblack/40'}>
                        {tt.sold.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      {editingId === tt._id ? (
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="text-xs font-semibold text-offblack/40 hover:text-offblack transition-colors"
                        >
                          Cancel
                        </button>
                      ) : confirmDeleteId === tt._id ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-xs text-offblack/50">
                            {adminRole === 'super_admin' && (game.ticketTypes.find(t => t._id === confirmDeleteId)?.sold ?? 1) === 0 ? 'Delete?' : 'Deactivate?'}
                          </span>
                          <button
                            type="button"
                            disabled={deleting}
                            onClick={() => handleDelete(tt._id)}
                            className="text-xs font-bold text-danger hover:text-danger/70 transition-colors disabled:opacity-50"
                          >
                            {deleting ? '…' : 'Yes'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setConfirmDeleteId(null); setDeleteError(null); }}
                            className="text-xs font-semibold text-offblack/40 hover:text-offblack transition-colors"
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-3">
                          {tt.active && (
                            <button
                              type="button"
                              onClick={() => startEdit(tt)}
                              className="text-xs font-semibold text-primary hover:text-primary/70 transition-colors"
                            >
                              Edit
                            </button>
                          )}
                          {tt.active && (
                            <button
                              type="button"
                              onClick={() => { setConfirmDeleteId(tt._id); setDeleteError(null); }}
                              className="text-xs font-semibold text-danger/50 hover:text-danger transition-colors"
                            >
                              {adminRole === 'super_admin' && tt.sold === 0 ? 'Delete' : 'Deactivate'}
                            </button>
                          )}
                          {!tt.active && (
                            <span className="text-xs text-offblack/40 italic">Deactivated</span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Delete error ── */}
            {deleteError && (
              <div className="border-t border-black/8 px-6 py-3 bg-danger/5">
                <p className="text-sm text-danger font-medium">{deleteError}</p>
              </div>
            )}

            {/* ── Inline edit panel ── */}
            {editingId && editForm && (
              <form
                onSubmit={handleEditSubmit}
                noValidate
                className="border-t border-black/8 px-6 py-5 bg-offwhite/40"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-offblack/40 mb-4">
                  Editing: {editForm.name}
                </p>

                <div className="flex flex-col gap-3">
                  {/* Name + Scope */}
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-offblack/50 uppercase tracking-wide">Name</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => updateEditField('name', e.target.value)}
                        className={`w-full rounded-lg border px-3 py-2.5 text-sm bg-white text-offblack
                          focus:outline-none focus:ring-2 focus:bg-white transition-all
                          ${editErrors.name ? 'border-danger focus:ring-danger/20' : 'border-black/12 focus:ring-primary/20 focus:border-primary/50'}`}
                      />
                      {editErrors.name && <p className="text-[11px] text-danger font-medium">{editErrors.name}</p>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-offblack/50 uppercase tracking-wide">Validity</label>
                      <select
                        value={editForm.scope}
                        onChange={(e) => updateEditField('scope', e.target.value)}
                        className="w-full rounded-lg border border-black/12 px-3 py-2.5 text-sm bg-white text-offblack
                          focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                      >
                        <option value="day">Single Day</option>
                        <option value="all">All Events (VIP)</option>
                      </select>
                    </div>
                  </div>

                  {/* Price + Service Fee + Quantity + QRs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-offblack/50 uppercase tracking-wide">Price (₱)</label>
                      <input
                        type="number"
                        min={0}
                        value={editForm.price}
                        onChange={(e) => updateEditField('price', e.target.value)}
                        className={`w-full rounded-lg border px-3 py-2.5 text-sm bg-white text-offblack
                          focus:outline-none focus:ring-2 focus:bg-white transition-all
                          ${editErrors.price ? 'border-danger focus:ring-danger/20' : 'border-black/12 focus:ring-primary/20 focus:border-primary/50'}`}
                      />
                      {editErrors.price && <p className="text-[11px] text-danger font-medium">{editErrors.price}</p>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-offblack/50 uppercase tracking-wide">Svc Fee (₱)</label>
                      <input
                        type="number"
                        min={0}
                        value={editForm.serviceFee}
                        onChange={(e) => updateEditField('serviceFee', e.target.value)}
                        className={`w-full rounded-lg border px-3 py-2.5 text-sm bg-white text-offblack
                          focus:outline-none focus:ring-2 focus:bg-white transition-all
                          ${editErrors.serviceFee ? 'border-danger focus:ring-danger/20' : 'border-black/12 focus:ring-primary/20 focus:border-primary/50'}`}
                      />
                      {editErrors.serviceFee && <p className="text-[11px] text-danger font-medium">{editErrors.serviceFee}</p>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-offblack/50 uppercase tracking-wide">Capacity</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={editForm.quantity}
                        onChange={(e) => updateEditField('quantity', e.target.value)}
                        className={`w-full rounded-lg border px-3 py-2.5 text-sm bg-white text-offblack
                          focus:outline-none focus:ring-2 focus:bg-white transition-all
                          ${editErrors.quantity ? 'border-danger focus:ring-danger/20' : 'border-black/12 focus:ring-primary/20 focus:border-primary/50'}`}
                      />
                      {editErrors.quantity && <p className="text-[11px] text-danger font-medium">{editErrors.quantity}</p>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-offblack/50 uppercase tracking-wide">QRs / Purchase</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={editForm.ticketsPerPurchase}
                        onChange={(e) => updateEditField('ticketsPerPurchase', e.target.value)}
                        className={`w-full rounded-lg border px-3 py-2.5 text-sm bg-white text-offblack
                          focus:outline-none focus:ring-2 focus:bg-white transition-all
                          ${editErrors.ticketsPerPurchase ? 'border-danger focus:ring-danger/20' : 'border-black/12 focus:ring-primary/20 focus:border-primary/50'}`}
                      />
                      {editErrors.ticketsPerPurchase && <p className="text-[11px] text-danger font-medium">{editErrors.ticketsPerPurchase}</p>}
                    </div>
                  </div>

                  {/* Edit error */}
                  {editError === 'conflict' ? (
                    <div className="flex items-center justify-between gap-3 bg-danger/5 rounded-lg px-3 py-2">
                      <p className="text-sm text-danger font-medium">
                        This ticket type was updated by another admin. Please refresh the page.
                      </p>
                      <button
                        type="button"
                        onClick={() => { cancelEdit(); loadGame(); }}
                        className="shrink-0 text-xs font-bold text-danger border border-danger/30 hover:bg-danger/10
                          px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Refresh
                      </button>
                    </div>
                  ) : editError ? (
                    <p className="text-sm text-danger font-medium bg-danger/5 rounded-lg px-3 py-2">
                      {editError}
                    </p>
                  ) : null}

                  {/* Edit actions */}
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-5 py-2.5 rounded-xl border border-black/12 text-sm font-semibold text-offblack/60 hover:text-offblack transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={editSaving}
                      className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed
                        text-white text-sm font-bold transition-all active:scale-[0.98] flex items-center gap-2"
                    >
                      {editSaving ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Saving…
                        </>
                      ) : (
                        'Save Changes →'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="px-6 py-10 text-center text-offblack/40 text-sm">
            Add ticket types below to get started.
          </div>
        )}
      </div>

      {/* ── Add ticket types form ── */}
      <form onSubmit={handleSubmit} noValidate className="bg-white rounded-2xl border border-black/8 shadow-sm overflow-hidden">
        <div className="bg-primary px-6 py-4">
          <p className="text-white font-bold text-sm">Add Ticket Types</p>
          <p className="text-white/60 text-xs mt-0.5">Add one or more ticket types at once.</p>
        </div>

        <div className="px-6 py-6 flex flex-col gap-6">

          {rows.map((row, i) => (
            <div key={i} className="flex flex-col gap-3 pb-4 border-b border-black/5 last:border-0 last:pb-0">
              {/* Row header */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-offblack/40">Ticket Type {i + 1}</p>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-xs font-semibold text-danger/60 hover:text-danger transition-colors"
                  >
                    × Remove
                  </button>
                )}
              </div>

              {/* Name + Scope row */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-3">
                {/* Name */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-offblack/50 uppercase tracking-wide">Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Single Day Pass"
                    value={row.name}
                    onChange={(e) => updateRow(i, 'name', e.target.value)}
                    list={`presets-${i}`}
                    className={`w-full rounded-lg border px-3 py-2.5 text-sm bg-offwhite/50 text-offblack
                      placeholder:text-offblack/25 focus:outline-none focus:ring-2 focus:bg-white transition-all
                      ${rowErrors[i]?.name ? 'border-danger focus:ring-danger/20' : 'border-black/12 focus:ring-primary/20 focus:border-primary/50'}`}
                  />
                  <datalist id={`presets-${i}`}>
                    {PRESET_NAMES.map((n) => <option key={n} value={n} />)}
                  </datalist>
                  {rowErrors[i]?.name && <p className="text-[11px] text-danger font-medium">{rowErrors[i].name}</p>}
                </div>

                {/* Scope */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-offblack/50 uppercase tracking-wide">Validity</label>
                  <select
                    value={row.scope}
                    onChange={(e) => updateRow(i, 'scope', e.target.value)}
                    className="w-full rounded-lg border border-black/12 px-3 py-2.5 text-sm bg-offwhite/50 text-offblack
                      focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-white transition-all"
                  >
                    <option value="day">Single Day</option>
                    <option value="all">All Events (VIP)</option>
                  </select>
                </div>
              </div>

              {/* Price + Service Fee + Quantity + QRs per purchase */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Price */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-offblack/50 uppercase tracking-wide">Price (₱)</label>
                  <input
                    type="number"
                    placeholder="50"
                    min={0}
                    value={row.price}
                    onChange={(e) => updateRow(i, 'price', e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2.5 text-sm bg-offwhite/50 text-offblack
                      placeholder:text-offblack/25 focus:outline-none focus:ring-2 focus:bg-white transition-all
                      ${rowErrors[i]?.price ? 'border-danger focus:ring-danger/20' : 'border-black/12 focus:ring-primary/20 focus:border-primary/50'}`}
                  />
                  {rowErrors[i]?.price && <p className="text-[11px] text-danger font-medium">{rowErrors[i].price}</p>}
                </div>

                {/* Service Fee */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-offblack/50 uppercase tracking-wide">Svc Fee (₱)</label>
                  <input
                    type="number"
                    placeholder="20"
                    min={0}
                    value={row.serviceFee}
                    onChange={(e) => updateRow(i, 'serviceFee', e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2.5 text-sm bg-offwhite/50 text-offblack
                      placeholder:text-offblack/25 focus:outline-none focus:ring-2 focus:bg-white transition-all
                      ${rowErrors[i]?.serviceFee ? 'border-danger focus:ring-danger/20' : 'border-black/12 focus:ring-primary/20 focus:border-primary/50'}`}
                  />
                  {rowErrors[i]?.serviceFee && <p className="text-[11px] text-danger font-medium">{rowErrors[i].serviceFee}</p>}
                </div>

                {/* Quantity */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-offblack/50 uppercase tracking-wide">Capacity</label>
                  <input
                    type="number"
                    placeholder="500"
                    min={1}
                    step={1}
                    value={row.quantity}
                    onChange={(e) => updateRow(i, 'quantity', e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2.5 text-sm bg-offwhite/50 text-offblack
                      placeholder:text-offblack/25 focus:outline-none focus:ring-2 focus:bg-white transition-all
                      ${rowErrors[i]?.quantity ? 'border-danger focus:ring-danger/20' : 'border-black/12 focus:ring-primary/20 focus:border-primary/50'}`}
                  />
                  {rowErrors[i]?.quantity && <p className="text-[11px] text-danger font-medium">{rowErrors[i].quantity}</p>}
                </div>

                {/* Tickets per purchase */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-offblack/50 uppercase tracking-wide">QRs / Purchase</label>
                  <input
                    type="number"
                    placeholder="1"
                    min={1}
                    step={1}
                    value={row.ticketsPerPurchase}
                    onChange={(e) => updateRow(i, 'ticketsPerPurchase', e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2.5 text-sm bg-offwhite/50 text-offblack
                      placeholder:text-offblack/25 focus:outline-none focus:ring-2 focus:bg-white transition-all
                      ${rowErrors[i]?.ticketsPerPurchase ? 'border-danger focus:ring-danger/20' : 'border-black/12 focus:ring-primary/20 focus:border-primary/50'}`}
                  />
                  {rowErrors[i]?.ticketsPerPurchase && <p className="text-[11px] text-danger font-medium">{rowErrors[i].ticketsPerPurchase}</p>}
                  <p className="text-[11px] text-offblack/30">Set 5 for family passes</p>
                </div>
              </div>
            </div>
          ))}

          {/* Add row */}
          <button
            type="button"
            onClick={addRow}
            className="self-start text-sm font-semibold text-primary hover:text-primary/70 flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add another type
          </button>

          {/* Success */}
          {successCount !== null && (
            <p className="text-sm text-primary font-medium bg-primary/5 rounded-lg px-3 py-2">
              ✓ {successCount} ticket type{successCount !== 1 ? 's' : ''} added successfully.
            </p>
          )}

          {/* API error */}
          {apiError && (
            <p className="text-sm text-danger font-medium bg-danger/5 rounded-lg px-3 py-2">
              {apiError}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <a
              href="/admin"
              className="flex-1 text-center border border-black/12 text-offblack/60 hover:text-offblack
                font-semibold py-3.5 rounded-xl transition-all text-sm"
            >
              Done
            </a>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed
                text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98]
                flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                `Save Ticket Type${rows.length > 1 ? 's' : ''} →`
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
