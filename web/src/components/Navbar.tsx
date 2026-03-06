'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="fixed top-0 inset-x-0 z-50 flex justify-center px-4 pt-3 pointer-events-none">
      <nav
        className={`pointer-events-auto w-full relative flex items-center justify-between
          bg-white/70 backdrop-blur-xl border border-white/50 shadow-lg
          rounded-2xl px-6 transition-all duration-300 ease-in-out
          ${scrolled ? 'max-w-xl h-12' : 'max-w-3xl h-16'}`}
      >
        {/* Find My Tickets — left placeholder for centering */}
        <Link
          href="/tickets/find"
          className="text-xs sm:text-sm font-semibold text-offblack/50 hover:text-offblack transition-colors whitespace-nowrap"
        >
          Find My Tickets
        </Link>

        {/* Logo — center */}
        <Link href="/" className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
          <Image
            src="/nbtc-smart.png"
            alt="NBTC"
            width={140}
            height={60}
            className={`object-contain w-auto transition-all duration-300 ${scrolled ? 'h-7' : 'h-11'}`}
            priority
          />
        </Link>

        {/* Right spacer */}
        <span className="text-xs sm:text-sm font-semibold invisible whitespace-nowrap">Find My Tickets</span>
      </nav>
    </div>
  );
}
