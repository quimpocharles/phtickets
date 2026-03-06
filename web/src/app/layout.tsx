import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tickets.globalhoops.com';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),

  title: {
    default: 'Global Hoops Tickets — Official Ticket Store',
    template: '%s | Global Hoops Tickets',
  },
  description:
    'Buy official Smart Global Hoops International Showcase tickets online. No log-in needed. ' +
    'Secure checkout powered by Maya. Visa, Mastercard, JCB, Amex & QR Ph accepted.',
  keywords: [
    'Global Hoops', 'Global Hoops tickets', 'Global Hoops International Showcase',
    'Smart Global Hoops', 'basketball tickets Philippines', 'online ticketing',
  ],
  authors: [{ name: 'Global Hoops International' }],
  creator: 'Global Hoops International',
  publisher: 'Global Hoops International',

  // ── Open Graph ─────────────────────────────────────────────────────────────
  openGraph: {
    type: 'website',
    locale: 'en_PH',
    url: APP_URL,
    siteName: 'Global Hoops Tickets',
    title: 'Global Hoops Tickets — Official Ticket Store',
    description:
      'Buy official Smart Global Hoops International Showcase tickets online. No log-in needed. ' +
      'Secure checkout powered by Maya.',
    images: [
      {
        url: '/gh-marquee.png',
        width: 1200,
        height: 630,
        alt: 'Smart x Global Hoops International Showcase — Official Ticket Store',
      },
    ],
  },

  // ── Twitter / X ────────────────────────────────────────────────────────────
  twitter: {
    card: 'summary_large_image',
    title: 'Global Hoops Tickets — Official Ticket Store',
    description: 'Buy official Smart Global Hoops International Showcase tickets online. No log-in needed.',
    images: ['/gh-marquee.png'],
  },

  // ── Icons ──────────────────────────────────────────────────────────────────
  icons: {
    icon: '/favico.png',
    apple: '/favico.png',
  },

  // ── PWA manifest ───────────────────────────────────────────────────────────
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Global Hoops Tickets',
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
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://tickets.globalhoops.com',
  logo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://tickets.globalhoops.com'}/favico.png`,
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
        <Navbar />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
