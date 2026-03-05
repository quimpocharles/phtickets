'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface FormState {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const EMPTY: FormState = { name: '', email: '', password: '', confirmPassword: '' };

export default function SetupForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const next: Partial<FormState> = {};
    if (!form.email.trim()) {
      next.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = 'Enter a valid email address.';
    }
    if (!form.password) {
      next.password = 'Password is required.';
    } else if (form.password.length < 8) {
      next.password = 'Password must be at least 8 characters.';
    }
    if (form.password !== form.confirmPassword) {
      next.confirmPassword = 'Passwords do not match.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setApiError(null);

    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

    try {
      const res = await fetch(`${API_URL}/admin/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:     form.name.trim() || undefined,
          email:    form.email.trim(),
          password: form.password,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setApiError(json.message ?? 'Registration failed.');
        return;
      }

      // Store token and redirect to the admin dashboard
      localStorage.setItem('adminToken', json.data.token);
      router.replace('/admin');
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
        <p className="text-white font-bold text-sm">Create Admin Account</p>
        <p className="text-white/60 text-xs mt-0.5">Only one administrator account can be created.</p>
      </div>

      <div className="px-6 py-6 flex flex-col gap-5">
        {/* Name (optional) */}
        <Field
          label="Name"
          type="text"
          placeholder="Juan dela Cruz"
          value={form.name}
          onChange={(v) => set('name', v)}
          optional
        />

        {/* Email */}
        <Field
          label="Email"
          type="email"
          placeholder="admin@example.com"
          value={form.email}
          onChange={(v) => set('email', v)}
          required
          error={errors.email}
        />

        {/* Password */}
        <Field
          label="Password"
          type="password"
          placeholder="Minimum 8 characters"
          value={form.password}
          onChange={(v) => set('password', v)}
          required
          error={errors.password}
        />

        {/* Confirm password */}
        <Field
          label="Confirm Password"
          type="password"
          placeholder="Repeat your password"
          value={form.confirmPassword}
          onChange={(v) => set('confirmPassword', v)}
          required
          error={errors.confirmPassword}
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
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed
            text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98]
            flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating account…
            </>
          ) : (
            'Create Admin Account →'
          )}
        </button>
      </div>
    </form>
  );
}

// ─── Field sub-component ──────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  optional?: boolean;
  error?: string;
}

function Field({ label, type, placeholder, value, onChange, required, optional, error }: FieldProps) {
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
      {error && <p className="text-[11px] text-danger font-medium">{error}</p>}
    </div>
  );
}
