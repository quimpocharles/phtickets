import type { Metadata } from 'next';
import './globals.css';
import PublicShell from '@/components/PublicShell';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.globalhoops.shop';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),

  title: {
    default: 'Global Hoops Passes — Official Pass Store',
    template: '%s | Global Hoops Passes',
  },
  description:
    'Buy official Smart Global Hoops International passes online. ' +
    'Mar 16–22, 2026 · Ateneo Blue Eagle Gym. ' +
    'Showcase, Camps, Prospect Combine & All Star Games. ' +
    'No log-in needed. Secure checkout. GCash, Maya, Card & QR Ph accepted.',
  keywords: [
    'Global Hoops', 'Global Hoops tickets', 'Global Hoops International',
    'Smart Global Hoops', 'basketball tickets Philippines', 'Ateneo Blue Eagle Gym',
    'Global Hoops 2026', 'basketball showcase Philippines', 'online ticketing',
  ],
  authors: [{ name: 'Global Hoops International' }],
  creator: 'Global Hoops International',
  publisher: 'Global Hoops International',

  // ── Open Graph ─────────────────────────────────────────────────────────────
  openGraph: {
    type: 'website',
    locale: 'en_PH',
    url: APP_URL,
    siteName: 'Global Hoops Passes',
    title: 'Smart Global Hoops 2026 — Get Your Passes Now',
    description:
      'Mar 16–22, 2026 · Ateneo Blue Eagle Gym. ' +
      'Showcase, Camps, Prospect Combine & All Star Games. ' +
      'Buy passes online — GCash, Maya, Card & QR Ph accepted.',
    images: [
      {
        url: '/smart-gh.jpg',
        width: 4501,
        height: 6000,
        alt: 'Smart Global Hoops International 2026 — Official Pass Store',
      },
    ],
  },

  // ── Twitter / X ────────────────────────────────────────────────────────────
  twitter: {
    card: 'summary_large_image',
    title: 'Smart Global Hoops 2026 — Get Your Passes Now',
    description:
      'Mar 16–22, 2026 · Ateneo Blue Eagle Gym. Showcase, Camps, Prospect Combine & All Star Games.',
    images: ['/smart-gh.jpg'],
  },

  // ── Icons ──────────────────────────────────────────────────────────────────
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },

  // ── PWA manifest ───────────────────────────────────────────────────────────
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Global Hoops Passes',
  },

  // ── Robots ─────────────────────────────────────────────────────────────────
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Global Hoops International',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.globalhoops.shop',
  logo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.globalhoops.shop'}/favico.png`,
  sameAs: [
    'https://www.facebook.com/profile.php?id=61571452187788',
    'https://www.instagram.com/globalhoopsint',
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="overflow-x-hidden">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <PublicShell>{children}</PublicShell>
      </body>
    </html>
  );
}
