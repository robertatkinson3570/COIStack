import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/upload', '/settings', '/support', '/api', '/auth', '/api/coi-grader'],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL || 'https://coistack.com'}/sitemap.xml`,
  };
}
