import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Anton } from 'next/font/google';
import { getGame, getGames } from '@/lib/api';
import TicketPurchasePanel from '@/components/TicketPurchasePanel';

const anton = Anton({ weight: '400', subsets: ['latin'], display: 'swap' });

export const revalidate = 60;

// Pre-build known game pages at build time
export async function generateStaticParams() {
  try {
    const games = await getGames();
    return games.map((g) => ({ gameId: g._id }));
  } catch {
    return [];
  }
}

interface Props {
  params: { gameId: string };
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tickets.globalhoops.com';

export async function generateMetadata({ params }: Props) {
  const game = await getGame(params.gameId);
  if (!game) return {};

  const date = new Date(game.gameDate).toLocaleDateString('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
  });
  const endDate = new Date(game.eventEndDate).toLocaleDateString('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
  });
  const dateRange = date === endDate ? date : `${date} – ${endDate}`;
  const title = `${game.description} — Official Tickets`;
  const description =
    `Get your official Smart Global Hoops International Showcase tickets for ${game.description}. ` +
    `${dateRange} at ${game.venue}. Secure checkout via Maya — no log-in needed. ` +
    `Visa, Mastercard, JCB, Amex & QR Ph accepted.`;
  const image = game.bannerImage ?? '/gh-marquee.png';
  const pageUrl = `${APP_URL}/tickets/${game._id}`;

  return {
    title,
    description,
    keywords: [
      'Global Hoops tickets', 'Smart Global Hoops', 'Global Hoops International Showcase tickets',
      'basketball tickets Philippines', game.venue, game.description,
      'buy basketball tickets online', 'Maya payment tickets',
    ],
    alternates: { canonical: pageUrl },
    openGraph: {
      type: 'website',
      title,
      description,
      url: pageUrl,
      siteName: 'Global Hoops Tickets',
      locale: 'en_PH',
      images: [{ url: image, width: 1200, height: 630, alt: `${game.description} — Smart Global Hoops International Showcase` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function GameDetailPage({ params }: Props) {
  const game = await getGame(params.gameId);
  if (!game) notFound();

  const gameDate = new Date(game.gameDate);
  const endDate  = new Date(game.eventEndDate);

  const TZ = 'Asia/Manila';
  const dateStr = gameDate.toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: TZ,
  });
  const timeStr = gameDate.toLocaleTimeString('en-PH', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ,
  });
  const endDateStr = endDate.toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: TZ,
  });
  const endTimeStr = endDate.toLocaleTimeString('en-PH', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ,
  });

  const dayKey    = (d: Date) => d.toLocaleDateString('en-PH', { timeZone: TZ });
  const sameDay   = dayKey(gameDate) === dayKey(endDate);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: game.description,
    startDate: game.gameDate,
    endDate: game.eventEndDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: game.venue,
      address: { '@type': 'PostalAddress', addressCountry: 'PH', addressLocality: 'Philippines' },
    },
    image: [game.bannerImage ?? `${APP_URL}/gh-marquee.png`],
    description:
      `Official Smart Global Hoops International Showcase. ` +
      `Buy tickets for ${game.description} at ${game.venue}. ` +
      `Secure checkout via Maya — no log-in needed.`,
    organizer: {
      '@type': 'Organization',
      name: 'Global Hoops International',
      url: APP_URL,
      sameAs: [
        'https://www.facebook.com/profile.php?id=61571452187788',
        'https://www.instagram.com/globalhoopsint',
      ],
    },
    sponsor: { '@type': 'Organization', name: 'Smart Communications' },
    sport: 'Basketball',
    url: `${APP_URL}/tickets/${game._id}`,
    offers: game.ticketTypes.map((tt) => ({
      '@type': 'Offer',
      name: tt.name,
      price: tt.price,
      priceCurrency: 'PHP',
      availability: tt.available > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/SoldOut',
      url: `${APP_URL}/tickets/${game._id}`,
      validFrom: game.createdAt,
      seller: { '@type': 'Organization', name: 'Global Hoops International' },
    })),
  };

  return (
    <div>
      {/* ── JSON-LD Event structured data ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Banner ── */}
      <div className="w-full bg-offblack ">
        <div className="flex min-h-[200px] sm:min-h-[240px]">

          {/* Left: text + bottom strip */}
          <div className="flex-1 flex flex-col justify-between pt-20 overflow-hidden">
            <div className="py-7 px-6 sm:px-10">
              <p className="text-accent font-black uppercase tracking-widest text-xs sm:text-sm mb-2">
                Global Hoops International Tickets
              </p>
              <h1 className="text-white font-black uppercase text-2xl sm:text-4xl leading-tight mb-2 max-w-2xl">
                {game.description}
              </h1>
              <p className="text-white/50 text-sm">
                Get your tickets in 5 easy steps &mdash; no log-in needed.
              </p>
            </div>

            {/* Bottom strip — marquee */}
            <div className="overflow-hidden h-14 sm:h-16 bg-danger relative">
              <style>{`
                @keyframes marquee {
                  0%   { transform: translateX(0); }
                  100% { transform: translateX(-50%); }
                }
                .marquee-track { animation: marquee 35s linear infinite; }
                .marquee-track:hover { animation-play-state: paused; }
              `}</style>
              <div className="marquee-track flex items-stretch h-full w-max">
                {[0, 1].map((i) => (
                  <div key={i} className="flex items-stretch h-full">
                    {/* Image thumbnail */}
                    {/* <div className="relative w-28 sm:w-44 shrink-0 overflow-hidden">
                      <Image src="/smart-gh.jpg" alt="" fill className="object-cover" />
                    </div> */}

                    {/* Date */}
                    <div className="bg-accent flex items-center justify-center px-6 shrink-0">
                      <span className={`${anton.className} uppercase text-offblack text-base sm:text-lg whitespace-nowrap`}>
                        {sameDay ? dateStr : `${dateStr} – ${endDateStr}`}
                      </span>
                    </div>

                    {/* Venue */}
                    <div className="bg-primary flex items-center justify-center px-6 shrink-0">
                      <span className={`${anton.className} uppercase text-white text-base sm:text-lg whitespace-nowrap`}>{game.venue}</span>
                    </div>

                    {/* Event name */}
                    <div className="bg-black flex items-center justify-center px-6 shrink-0">
                      <span className={`${anton.className} uppercase text-white text-base sm:text-lg whitespace-nowrap`}>
                        Global Hoops International Showcase
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="hidden sm:block relative border-l-2 border-dashed border-black/15 min-w-[220px] bg-black">
            <Image src="/smart-gh.jpg" alt="Smart x Global Hoops" fill className="object-cover" />
          </div>

        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <TicketPurchasePanel game={game} />
      </div>
    </div>
  );
}
