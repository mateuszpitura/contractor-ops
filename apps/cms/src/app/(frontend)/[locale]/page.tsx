import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { isSupportedLocale } from '@/i18n/config';
import { fetchPublishedPosts } from '@/lib/payload-queries';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'The Contractor-Ops Journal',
    alternates: {
      canonical: `/${locale}`,
      languages: { en: '/en', pl: '/pl', de: '/de', ar: '/ar' },
    },
  };
}

export default async function LocaleHome({ params }: Props): Promise<React.ReactNode> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }
  const typed: Locale = locale;
  const { docs } = await fetchPublishedPosts({ locale: typed, limit: 3 });

  return (
    <div className="home">
      <section className="hero container">
        <p className="eyebrow">Field notes</p>
        <h1 className="hero__title">
          Compliance, payouts, and contracts — written for cross-border independents.
        </h1>
        <p className="hero__lede">
          Deep-dives, product changelogs, and jurisdiction primers from the team building
          Contractor-Ops.
        </p>
        <div className="hero__cta">
          <Link href={`/${typed}/blog`} className="button button--primary">
            Read every article
          </Link>
          <Link href={`/${typed}/feed.xml`} className="button button--ghost">
            RSS
          </Link>
        </div>
      </section>

      {docs.length > 0 && (
        <section className="container featured">
          <header className="featured__header">
            <h2>Latest</h2>
            <Link href={`/${typed}/blog`} className="featured__more">
              Browse all →
            </Link>
          </header>
          <ul className="featured__grid">
            {docs.map(post => (
              <li key={post.id}>
                <article className="post-card">
                  <Link
                    href={`/${typed}/blog/${post.slug}`}
                    className="post-card__link"
                    aria-label={post.title}>
                    <p className="eyebrow">
                      {post.publishedAt
                        ? new Date(post.publishedAt).toLocaleDateString(typed, {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })
                        : '—'}
                    </p>
                    <h3 className="post-card__title">{post.title}</h3>
                    {post.excerpt ? <p className="post-card__excerpt">{post.excerpt}</p> : null}
                    <span className="post-card__byline">{post.author}</span>
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
