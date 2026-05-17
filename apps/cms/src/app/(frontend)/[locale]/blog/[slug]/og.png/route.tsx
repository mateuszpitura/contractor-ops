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
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #18181d 60%, #2a1f15 100%)',
        color: '#f5f5f5',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: 16,
            background: '#d4b896',
            color: '#0a0a0a',
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}>
          CO
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 22,
            color: '#9a9aa1',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
          <span>Contractor-Ops</span>
          <span style={{ color: '#6b6b73', fontSize: 18 }}>Journal · {locale.toUpperCase()}</span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          maxWidth: 1040,
        }}>
        <div
          style={{
            fontSize: 64,
            lineHeight: 1.08,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#f5f5f5',
          }}>
          {post.title.length > 110 ? `${post.title.slice(0, 107)}…` : post.title}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 26,
            color: '#d4b896',
            letterSpacing: '0.02em',
          }}>
          {post.author}
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
