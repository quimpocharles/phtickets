import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Page Not Found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-offwhite flex flex-col items-center justify-center px-6 text-center gap-6">
      <Image src="/smart-logo.png" alt="Smart" width={120} height={120} className="object-contain h-12 w-auto" />

      <div>
        <p className="text-6xl font-black text-offblack/10 leading-none">404</p>
        <h1 className="text-xl font-black uppercase text-offblack mt-1">Page not found</h1>
        <p className="text-sm text-offblack/50 mt-2 max-w-xs">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>

      <Link
        href="/"
        className="bg-offblack hover:bg-black text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm"
      >
        Get Tickets →
      </Link>
    </div>
  );
}
