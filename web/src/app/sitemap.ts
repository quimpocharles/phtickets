import type { MetadataRoute } from 'next';
import { getGames } from '@/lib/api';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? 'https://passes.globalhoops.com';

  const staticRoutes: MetadataRoute.Sitemap = [
    { url, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${url}/passes/find`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${url}/legal`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
  ];

  try {
    const games = await getGames();
    const gameRoutes: MetadataRoute.Sitemap = games.map((g) => ({
      url: `${url}/passes/${g._id}`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1.0,
    }));
    return [...staticRoutes, ...gameRoutes];
  } catch {
    return staticRoutes;
  }
}
