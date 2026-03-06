import type { MetadataRoute } from 'next';
import { getGames } from '@/lib/api';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tickets.globalhoops.com';

  const staticRoutes: MetadataRoute.Sitemap = [
    { url, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${url}/tickets/find`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];

  try {
    const games = await getGames();
    const gameRoutes: MetadataRoute.Sitemap = games.map((g) => ({
      url: `${url}/tickets/${g._id}`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    }));
    return [...staticRoutes, ...gameRoutes];
  } catch {
    return staticRoutes;
  }
}
