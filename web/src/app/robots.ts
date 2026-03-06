import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tickets.globalhoops.com';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/scanner/'],
      },
    ],
    sitemap: `${url}/sitemap.xml`,
  };
}
