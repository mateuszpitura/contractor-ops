import { SUPPORTED_LOCALES } from '@/i18n/config';
import { getCmsEnv } from '@/lib/env';
import { listAllPublishedSlugs } from '@/lib/payload-queries';

export const dynamic = 'force-dynamic';

function urlElement(loc: string, lastmod?: string): string {
  const parts = ['  <url>', `    <loc>${loc}</loc>`];
  if (lastmod) {
    parts.push(`    <lastmod>${lastmod}</lastmod>`);
  }
  parts.push('  </url>');
  return parts.join('\n');
}

export async function GET(): Promise<Response> {
  const env = getCmsEnv();
  const origin = env.CMS_PUBLIC_URL.replace(/\/$/, '');
  const lastmod = new Date().toISOString();

  const urls: string[] = [];
  for (const locale of SUPPORTED_LOCALES) {
    urls.push(urlElement(`${origin}/${locale}`, lastmod));
    urls.push(urlElement(`${origin}/${locale}/blog`, lastmod));
    const slugs = await listAllPublishedSlugs(locale);
    for (const slug of slugs) {
      urls.push(urlElement(`${origin}/${locale}/blog/${slug}`, lastmod));
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 's-maxage=300, stale-while-revalidate=600',
    },
  });
}
