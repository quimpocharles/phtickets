import { redirect } from 'next/navigation';
import SetupForm from './SetupForm';

async function getSetupStatus(): Promise<boolean> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  try {
    const res = await fetch(`${API_URL}/admin/setup-status`, { cache: 'no-store' });
    const json = await res.json();
    return json.data?.setupRequired ?? false;
  } catch {
    return false;
  }
}

export default async function AdminSetupPage() {
  const setupRequired = await getSetupStatus();

  if (!setupRequired) {
    redirect('/admin/login');
  }

  return (
    <main className="min-h-screen bg-offwhite flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-offblack">Admin Setup</h1>
          <p className="text-sm text-offblack/50 mt-1">
            Create the administrator account to get started.
            <br />
            This page will not be accessible again.
          </p>
        </div>

        <SetupForm />
      </div>
    </main>
  );
}
