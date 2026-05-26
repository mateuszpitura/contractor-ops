import { ImageResponse } from 'next/og';
import { isSupportedLocale } from '@/i18n/config';
import { fetchPublishedPostBySlug } from '@/lib/payload-queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { locale: string; slug: string };

export async function GET(_req: Request, ctx: { params: Promise<Params> }): Promise<Response> {
  const { locale, slug } = await ctx.params;
  if (!isSupportedLocale(locale)) {
    return new Response('Not found', { status: 404 });
  }
  const post = await fetchPublishedPostBySlug(slug, locale);
  if (!post) {
    return new Response('Not found', { status: 404 });
  }

  return new ImageResponse(
    <div>
      <div>
        <div>CO</div>
        <div>
          <span>Contractor-Ops</span>
          <span>Journal · {locale.toUpperCase()}</span>
        </div>
      </div>

      <div>
        <div>{post.title.length > 110 ? `${post.title.slice(0, 107)}…` : post.title}</div>
        <div>{post.author}</div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
