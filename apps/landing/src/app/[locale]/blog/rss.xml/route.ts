import { createLogger } from '@contractor-ops/logger';
import type { Locale } from '@/i18n';
import { defaultLocale, isValidLocale } from '@/i18n';
import { getPosts } from '@/lib/cms';

const log = createLogger({ service: 'landing-blog-rss' });

export const dynamic = 'force-static';

export function generateStaticParams() {
  return ['en', 'pl', 'de', 'ar'].map(locale => ({ locale }));
}

const SITE_URL = process.env.NEXT_PUBLIC_LANDING_URL ?? 'https://contractor-ops.io';

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(_req: Request, context: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await context.params;
  const locale: Locale = isValidLocale(localeParam) ? localeParam : defaultLocale;

  let docs: Awaited<ReturnType<typeof getPosts>>['docs'] = [];
  try {
    const data = await getPosts({ locale, limit: 20 });
    docs = data.docs;
  } catch (error) {
    log.warn({ err: error, locale }, 'CMS unreachable, emitting empty RSS');
    docs = [];
  }

  const channelTitle = 'Contractor Ops — Blog';
  const channelLink = `${SITE_URL}/${locale}/blog`;
  const channelDescription =
    'Field notes, product updates, and finance-ops thinking from the Contractor Ops team.';

  const items = docs
    .map(post => {
      const link = `${SITE_URL}/${locale}/blog/${post.slug}`;
      const pubDate = post.publishedAt
        ? new Date(post.publishedAt).toUTCString()
        : new Date().toUTCString();
      const description = post.excerpt ?? '';
      return `
        <item>
          <title>${escapeXml(post.title)}</title>
          <link>${escapeXml(link)}</link>
          <guid isPermaLink="true">${escapeXml(link)}</guid>
          <pubDate>${pubDate}</pubDate>
          <description><![CDATA[${description}]]></description>
          ${post.categories.map(c => `<category>${escapeXml(c.name)}</category>`).join('')}
        </item>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${escapeXml(channelLink)}</link>
    <description>${escapeXml(channelDescription)}</description>
    <language>${escapeXml(locale)}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
