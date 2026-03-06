'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface AdminUser {
  _id: string;
  name: string | null;
  email: string;
  role: 'super_admin' | 'admin' | 'scanner';
  createdAt: string;
  status: 'active' | 'deleted';
}

type Mode =
  | { type: 'idle' }
  | { type: 'create' }
  | { type: 'editRole'; id: string; role: 'admin' | 'scanner' };

type ConfirmAction = { id: string; email: string; permanent: boolean };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function AdminUsersPage() {
  const router = useRouter();

  const [admins, setAdmins]   = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [mode, setMode]       = useState<Mode>({ type: 'idle' });
  const [myId, setMyId]       = useState('');
  const [myRole, setMyRole]   = useState('');
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [acting, setActing]   = useState(false);

  useEffect(() => {
    setMyId(localStorage.getItem('adminId') ?? '');
    setMyRole(localStorage.getItem('adminRole') ?? '');
  }, []);

  const fetchAdmins = useCallback(async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) { router.replace('/admin/login'); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/admin/admins`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { localStorage.removeItem('adminToken'); router.replace('/admin/login'); return; }
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setAdmins(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  function onCreated(admin: AdminUser) {
    setAdmins((prev) => [...prev, admin]);
    setMode({ type: 'idle' });
  }

  async function handleSaveRole(id: string, role: string) {
    const token = localStorage.getItem('adminToken');
    setActing(true);
    try {
      const res = await fetch(`${API_URL}/admin/admins/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setAdmins((prev) => prev.map((a) => a._id === id ? { ...a, role: json.data.role } : a));
      setMode({ type: 'idle' });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update role.');
    } finally {
      setActing(false);
    }
  }

  async function handleDelete(id: string, permanent: boolean) {
    const token = localStorage.getItem('adminToken');
    setActing(true);
    try {
      const url = permanent
        ? `${API_URL}/admin/admins/${id}?permanent=true`
        : `${API_URL}/admin/admins/${id}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      if (permanent) {
        setAdmins((prev) => prev.filter((a) => a._id !== id));
      } else {
        setAdmins((prev) => prev.map((a) => a._id === id ? { ...a, status: 'deleted' } : a));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActing(false);
      setConfirm(null);
    }
  }

  const activeCount = admins.filter((a) => a.status === 'active').length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-black text-offblack">Admin Users</h1>
          <p className="text-sm text-offblack/40 mt-1">
            {activeCount} active user{activeCount !== 1 ? 's' : ''}
          </p>
        </div>
        {mode.type === 'idle' && myRole === 'super_admin' && (
          <button
            onClick={() => setMode({ type: 'create' })}
            className="bg-primary hover:bg-primary/90 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all active:scale-[0.98]"
          >
            + Create Admin
          </button>
        )}
      </div>

      {/* ── Create form — super_admin only ── */}
      {mode.type === 'create' && myRole === 'super_admin' && (
        <div className="mb-6">
          <CreateAdminForm
            onCreated={onCreated}
            onCancel={() => setMode({ type: 'idle' })}
          />
        </div>
      )}

      {/* ── States ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-danger font-semibold mb-2">Failed to load users</p>
          <p className="text-sm text-offblack/50 mb-4">{error}</p>
          <button onClick={fetchAdmins} className="text-primary text-sm font-bold hover:underline">
            Try again
          </button>
        </div>
      ) : admins.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm px-6 py-16 text-center">
          <p className="text-offblack/40 text-sm">No admin users found.</p>
        </div>
      ) : (

        /* ── Table ── */
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/8 bg-offwhite/60">
                  {['Name', 'Email', 'Role', 'Created At', 'Status', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className={`px-5 py-3 text-xs font-bold text-offblack/40 uppercase tracking-widest
                        ${h === 'Actions' ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {admins.map((admin) => {
                  const isMe          = admin._id === myId;
                  const confirmForRow = confirm?.id === admin._id ? confirm : null;

                  return (
                    <tr
                      key={admin._id}
                      className={`hover:bg-offwhite/40 transition-colors ${admin.status === 'deleted' ? 'opacity-55' : ''}`}
                    >
                      {/* Name */}
                      <td className="px-5 py-4 font-medium text-offblack whitespace-nowrap">
                        {admin.name ?? <span className="text-offblack/30 italic text-xs">No name</span>}
                        {isMe && (
                          <span className="ml-2 text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded-full">
                            You
                          </span>
                        )}
                      </td>

                      {/* Email */}
                      <td className="px-5 py-4 text-offblack/60">{admin.email}</td>

                      {/* Role */}
                      <td className="px-5 py-4">
                        <RoleBadge role={admin.role} />
                      </td>

                      {/* Created At */}
                      <td className="px-5 py-4 text-offblack/50 whitespace-nowrap">
                        {new Date(admin.createdAt).toLocaleDateString('en-PH', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <StatusBadge status={admin.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        {isMe ? (
                          <span className="text-xs text-offblack/25">—</span>
                        ) : confirmForRow ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-offblack/50">
                              {confirmForRow.permanent ? 'Permanently delete?' : 'Deactivate?'}
                            </span>
                            <button
                              onClick={() => handleDelete(admin._id, confirmForRow.permanent)}
                              disabled={acting}
                              className="text-xs font-bold text-white bg-danger hover:bg-danger/80 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {acting ? '…' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setConfirm(null)}
                              disabled={acting}
                              className="text-xs font-bold text-offblack/60 hover:text-offblack border border-black/12 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              No
                            </button>
                          </div>
                        ) : mode.type === 'editRole' && mode.id === admin._id ? (
                          <EditRoleInline
                            currentRole={mode.role}
                            saving={acting}
                            onSave={(r) => handleSaveRole(admin._id, r)}
                            onCancel={() => setMode({ type: 'idle' })}
                          />
                        ) : (
                          <div className="flex items-center justify-end gap-3">
                            {/* Edit Role — only for non-super_admin active accounts */}
                            {admin.status === 'active' && admin.role !== 'super_admin' && (
                              <button
                                onClick={() =>
                                  setMode({ type: 'editRole', id: admin._id, role: admin.role as 'admin' | 'scanner' })
                                }
                                className="text-xs font-bold text-offblack/40 hover:text-offblack transition-colors"
                              >
                                Edit Role
                              </button>
                            )}

                            {/* Soft delete — any active account */}
                            {admin.status === 'active' && (
                              <button
                                onClick={() => setConfirm({ id: admin._id, email: admin.email, permanent: false })}
                                className="text-xs font-bold text-offblack/40 hover:text-danger transition-colors"
                              >
                                Deactivate
                              </button>
                            )}

                            {/* Hard delete — super_admin viewer only */}
                            {myRole === 'super_admin' && (
                              <button
                                onClick={() => setConfirm({ id: admin._id, email: admin.email, permanent: true })}
                                className="text-xs font-bold text-danger/40 hover:text-danger transition-colors"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RoleBadge ──────────────────────────────────────────────────────────────────

const ROLE_STYLES: Record<string, string> = {
  super_admin: 'bg-primary/10 text-primary',
  admin:       'bg-accent/30 text-offblack',
  scanner:     'bg-black/6 text-offblack/60',
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin:       'Admin',
  scanner:     'Scanner',
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${ROLE_STYLES[role] ?? 'bg-black/6 text-offblack/60'}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

// ── StatusBadge ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return status === 'active' ? (
    <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
      Active
    </span>
  ) : (
    <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-danger/10 text-danger">
      Disabled
    </span>
  );
}

// ── EditRoleInline ─────────────────────────────────────────────────────────────

interface EditRoleInlineProps {
  currentRole: 'admin' | 'scanner';
  saving: boolean;
  onSave: (role: string) => void;
  onCancel: () => void;
}

function EditRoleInline({ currentRole, saving, onSave, onCancel }: EditRoleInlineProps) {
  const [role, setRole] = useState(currentRole);

  return (
    <div className="flex items-center justify-end gap-2">
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as 'admin' | 'scanner')}
        className="text-xs border border-black/12 rounded-lg px-2 py-1.5 bg-offwhite text-offblack
          focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
      >
        <option value="admin">Admin</option>
        <option value="scanner">Scanner</option>
      </select>
      <button
        onClick={() => onSave(role)}
        disabled={saving}
        className="text-xs font-bold text-white bg-primary hover:bg-primary/90 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
      >
        {saving ? '…' : 'Save'}
      </button>
      <button
        onClick={onCancel}
        disabled={saving}
        className="text-xs font-bold text-offblack/60 hover:text-offblack border border-black/12 px-2.5 py-1 rounded-lg transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

// ── CreateAdminForm ────────────────────────────────────────────────────────────

interface CreateAdminFormProps {
  onCreated: (admin: AdminUser) => void;
  onCancel: () => void;
}

function CreateAdminForm({ onCreated, onCancel }: CreateAdminFormProps) {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole]         = useState<'admin' | 'scanner'>('admin');
  const [saving, setSaving]     = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errors, setErrors]     = useState<Record<string, string>>({});

  function validate() {
    const next: Record<string, string> = {};
    if (!email.trim()) next.email = 'Email is required.';
    if (!password) next.password = 'Password is required.';
    else if (password.length < 8) next.password = 'Must be at least 8 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setApiError(null);
    const token = localStorage.getItem('adminToken');

    try {
      const res = await fetch(`${API_URL}/admin/admins`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || undefined, email: email.trim(), password, role }),
      });
      const json = await res.json();
      if (!res.ok) { setApiError(json.message ?? 'Something went wrong.'); return; }
      onCreated({ ...json.data, createdAt: new Date().toISOString(), status: 'active' });
    } catch {
      setApiError('Could not reach the server.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = (err?: string) =>
    `w-full rounded-lg border px-3 py-2.5 text-sm bg-offwhite/50 text-offblack placeholder:text-offblack/25
    focus:outline-none focus:ring-2 focus:bg-white transition-all
    ${err ? 'border-danger focus:ring-danger/20' : 'border-black/12 focus:ring-primary/20 focus:border-primary/50'}`;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-white rounded-2xl border border-primary/20 shadow-sm overflow-hidden"
    >
      <div className="bg-primary px-5 py-3.5">
        <p className="text-white font-bold text-sm">Create Admin User</p>
      </div>

      <div className="px-5 py-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-offblack/70 uppercase tracking-wide">
              Name <span className="text-offblack/30 font-normal normal-case">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls()}
            />
          </div>

          {/* Role */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-offblack/70 uppercase tracking-wide">
              Role <span className="text-danger">*</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'scanner')}
              className={inputCls()}
            >
              <option value="admin">Admin</option>
              <option value="scanner">Scanner</option>
            </select>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-offblack/70 uppercase tracking-wide">
              Email <span className="text-danger">*</span>
            </label>
            <input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '' })); }}
              className={inputCls(errors.email)}
            />
            {errors.email && <p className="text-[11px] text-danger font-medium">{errors.email}</p>}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-offblack/70 uppercase tracking-wide">
              Password <span className="text-danger">*</span>
            </label>
            <input
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: '' })); }}
              className={inputCls(errors.password)}
            />
            {errors.password && <p className="text-[11px] text-danger font-medium">{errors.password}</p>}
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
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</>
            ) : (
              'Create Admin'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
