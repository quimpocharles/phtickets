'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Anton } from 'next/font/google';

const anton = Anton({ weight: '400', subsets: ['latin'], display: 'swap' });

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="fixed top-0 inset-x-0 z-50 flex justify-center px-4 pt-3 pointer-events-none">
      <nav
        className={`pointer-events-auto w-full flex flex-col
          bg-offblack border border-white/10 shadow-lg
          rounded-2xl px-6 transition-all duration-300 ease-in-out
          ${scrolled ? 'max-w-xl' : 'max-w-3xl'}`}
      >
        {/* Main row */}
        <div className={`flex items-center justify-between transition-all duration-300 ${scrolled ? 'h-12' : 'h-16'}`}>

          {/* Left — Smart logo + title */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/smart-logo.png"
              alt="Smart"
              width={300}
              height={300}
              className={`object-contain w-auto transition-all duration-300 ${scrolled ? 'h-5 sm:h-6' : 'h-7 sm:h-9'}`}
              priority
            />
            <span className={`${anton.className} uppercase tracking-wide leading-none transition-all duration-300 whitespace-nowrap ${scrolled ? 'text-sm sm:text-base' : 'text-lg sm:text-2xl'}`}>
              <span className="text-accent">Global</span>
              {' '}
              <span className="text-danger">Hoops</span>
              {' '}
              <span className="text-white sm:hidden">INTL</span>
              <span className="text-white hidden sm:inline">International</span>
            </span>
          </Link>

          {/* Right — desktop link / mobile burger */}
          <Link
            href="/tickets/find"
            className="hidden sm:block text-sm font-semibold text-white/50 hover:text-white transition-colors whitespace-nowrap"
          >
            Find My Tickets
          </Link>

          <button
            type="button"
            aria-label="Menu"
            onClick={() => setMenuOpen((o) => !o)}
            className="sm:hidden flex flex-col items-center justify-center gap-1.5 w-8 h-8"
          >
            <span className={`block w-5 h-0.5 bg-white/70 transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-5 h-0.5 bg-white/70 transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-white/70 transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="sm:hidden border-t border-white/10 py-3">
            <Link
              href="/tickets/find"
              onClick={() => setMenuOpen(false)}
              className="block text-sm font-semibold text-white/60 hover:text-white transition-colors py-1"
            >
              Find My Tickets
            </Link>
          </div>
        )}
      </nav>
    </div>
  );
}
