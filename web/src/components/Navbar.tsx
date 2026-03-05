import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="bg-primary text-white">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/tickets" className="flex items-center gap-2 group">
          {/* Court-dot wordmark */}
          <span className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-primary" />
          </span>
          <span className="text-lg font-black tracking-wider uppercase">NBTC</span>
          <span className="text-sm font-medium text-white/60 hidden sm:block">Tickets</span>
        </Link>

        <div className="flex items-center gap-5">
          <Link
            href="/tickets/find"
            className="text-sm font-semibold text-white/60 hover:text-white transition-colors"
          >
            Find My Tickets
          </Link>
          <Link
            href="/tickets"
            className="text-sm font-semibold text-white/80 hover:text-white transition-colors"
          >
            Upcoming Games
          </Link>
        </div>
      </div>
    </nav>
  );
}
