'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function CancelContent() {
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm p-8 flex flex-col items-center gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </div>

        <div>
          <h1 className="text-lg font-bold text-gray-900">Payment Cancelled</h1>
          <p className="text-sm text-gray-500 mt-1">
            You cancelled the payment. Your seats have been released.
          </p>
        </div>

        {ref && (
          <p className="text-xs text-gray-400 font-mono">Ref: {ref}</p>
        )}

        <div className="w-full flex flex-col gap-2 mt-2">
          <a
            href="/"
            className="w-full bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold py-3 rounded-xl transition-colors text-center"
          >
            Browse Tickets
          </a>
          <a
            href="/"
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PaymentCancelPage() {
  return (
    <Suspense>
      <CancelContent />
    </Suspense>
  );
}
