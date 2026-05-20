import { changelog } from '@/lib/changelog';

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
  const { locale } = await context.params;
  const channelTitle = 'Contractor Ops — Changelog';
  const channelLink = `${SITE_URL}/${locale}/changelog`;
  const channelDescription = 'Release notes and product updates for Contractor Ops.';

  const items = changelog
    .map(entry => {
      const link = `${channelLink}#${entry.version}`;
      const description = entry.bullets
        ? `${entry.summary}<ul>${entry.bullets.map(b => `<li>${escapeXml(b)}</li>`).join('')}</ul>`
        : entry.summary;
      return `
        <item>
          <title>${escapeXml(`${entry.version} — ${entry.title}`)}</title>
          <link>${escapeXml(link)}</link>
          <guid isPermaLink="false">${escapeXml(`${SITE_URL}/changelog/${entry.version}`)}</guid>
          <pubDate>${new Date(entry.date).toUTCString()}</pubDate>
          <description><![CDATA[${description}]]></description>
          ${entry.tags.map(t => `<category>${escapeXml(t)}</category>`).join('')}
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
