import { isSupportedLocale } from '@/i18n/config';
import { getCmsEnv } from '@/lib/env';
import { fetchPublishedPosts } from '@/lib/payload-queries';

export const dynamic = 'force-dynamic';

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ locale: string }> },
): Promise<Response> {
  const { locale } = await ctx.params;
  if (!isSupportedLocale(locale)) {
    return new Response('Not found', { status: 404 });
  }
  const env = getCmsEnv();
  const origin = env.CMS_PUBLIC_URL.replace(/\/$/, '');
  const { docs } = await fetchPublishedPosts({ locale, limit: 20 });

  const items = docs
    .map(post => {
      const link = `${origin}/${locale}/blog/${post.slug}`;
      const pubDate = post.publishedAt
        ? new Date(post.publishedAt).toUTCString()
        : new Date().toUTCString();
      return [
        '    <item>',
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${pubDate}</pubDate>`,
        `      <author>${escapeXml(post.author)}</author>`,
        post.excerpt ? `      <description>${escapeXml(post.excerpt)}</description>` : '',
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Contractor-Ops Journal — ${locale.toUpperCase()}</title>
    <link>${origin}/${locale}/blog</link>
    <atom:link href="${origin}/${locale}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Compliance, payouts, and cross-border contracting insights.</description>
    <language>${locale}</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 's-maxage=300, stale-while-revalidate=600',
    },
  });
}
