import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tickets.nbtc.com';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),

  title: {
    default: 'NBTC Tickets — Official Ticket Store',
    template: '%s | NBTC Tickets',
  },
  description:
    'Buy official NBTC National Finals tickets online. No log-in needed. ' +
    'Secure checkout powered by Maya. Visa, Mastercard, JCB, Amex & QR Ph accepted.',
  keywords: [
    'NBTC', 'NBTC tickets', 'NBTC National Finals', 'basketball tickets',
    'buy basketball tickets Philippines', 'Smart NBTC', 'online ticketing',
  ],
  authors: [{ name: 'NBTC' }],
  creator: 'NBTC',
  publisher: 'NBTC',

  // ── Open Graph ─────────────────────────────────────────────────────────────
  openGraph: {
    type: 'website',
    locale: 'en_PH',
    url: APP_URL,
    siteName: 'NBTC Tickets',
    title: 'NBTC Tickets — Official Ticket Store',
    description:
      'Buy official NBTC National Finals tickets online. No log-in needed. ' +
      'Secure checkout powered by Maya.',
    images: [
      {
        url: '/nbtc-smart.png',
        width: 1200,
        height: 630,
        alt: 'NBTC x Smart — Official Ticket Store',
      },
    ],
  },

  // ── Twitter / X ────────────────────────────────────────────────────────────
  twitter: {
    card: 'summary_large_image',
    title: 'NBTC Tickets — Official Ticket Store',
    description: 'Buy official NBTC National Finals tickets online. No log-in needed.',
    images: ['/nbtc-smart.png'],
  },

  // ── Icons ──────────────────────────────────────────────────────────────────
  icons: {
    icon: '/nbtc-logo.jpg',
    apple: '/nbtc-logo.jpg',
  },

  // ── PWA manifest ───────────────────────────────────────────────────────────
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'NBTC Tickets',
  },

  // ── Robots ─────────────────────────────────────────────────────────────────
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
