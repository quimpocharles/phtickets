'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (localStorage.getItem('adminToken')) {
      router.replace('/admin');
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);
    setError(null);

    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

    try {
      const res = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.message ?? 'Login failed.');
        return;
      }

      localStorage.setItem('adminToken', json.data.token);
      localStorage.setItem('adminRole', json.data.admin.role);
      localStorage.setItem('adminId',   json.data.admin._id);
      router.replace(json.data.admin.role === 'scanner' ? '/scanner' : '/admin');
    } catch {
      setError('Could not reach the server. Please try again.');
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
        <p className="text-white font-bold text-sm">Sign In</p>
        <p className="text-white/60 text-xs mt-0.5">Enter your admin credentials below.</p>
      </div>

      <div className="px-6 py-6 flex flex-col gap-5">
        {/* Email */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-offblack/70 uppercase tracking-wide">
            Email <span className="text-danger">*</span>
          </label>
          <input
            type="email"
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            autoComplete="email"
            className="w-full rounded-lg border border-black/12 px-3 py-2.5 text-sm bg-offwhite/50
              text-offblack placeholder:text-offblack/25 focus:outline-none focus:ring-2
              focus:ring-primary/20 focus:border-primary/50 focus:bg-white transition-all"
          />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-offblack/70 uppercase tracking-wide">
            Password <span className="text-danger">*</span>
          </label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            autoComplete="current-password"
            className="w-full rounded-lg border border-black/12 px-3 py-2.5 text-sm bg-offwhite/50
              text-offblack placeholder:text-offblack/25 focus:outline-none focus:ring-2
              focus:ring-primary/20 focus:border-primary/50 focus:bg-white transition-all"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-danger font-medium bg-danger/5 rounded-lg px-3 py-2">
            {error}
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
              Signing in…
            </>
          ) : (
            'Sign In →'
          )}
        </button>
      </div>
    </form>
  );
}
