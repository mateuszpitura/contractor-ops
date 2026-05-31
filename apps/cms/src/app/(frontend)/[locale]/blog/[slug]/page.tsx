import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { LexicalRenderer } from '@/components/blog/lexical-renderer';
import type { Locale } from '@/i18n/config';
import { isSupportedLocale, SUPPORTED_LOCALES } from '@/i18n/config';
import { fetchPublishedPostBySlug, listLocalesForSlug } from '@/lib/payload-queries';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) {
    return {};
  }
  const post = await fetchPublishedPostBySlug(slug, locale);
  if (!post) {
    return {};
  }
  const localesAvailable = await listLocalesForSlug(slug);
  const languages = Object.fromEntries(localesAvailable.map(alt => [alt, `/${alt}/blog/${slug}`]));

  return {
    title: post.seo?.title ?? post.title,
    description: post.seo?.description ?? post.excerpt ?? undefined,
    openGraph: {
      title: post.seo?.title ?? post.title,
      description: post.seo?.description ?? post.excerpt ?? undefined,
      type: 'article',
      url: `/${locale}/blog/${slug}`,
      images: [
        {
          url: `/${locale}/blog/${slug}/og.png`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
      publishedTime: post.publishedAt ?? undefined,
      authors: [post.author],
      locale,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.seo?.title ?? post.title,
      description: post.seo?.description ?? post.excerpt ?? undefined,
      images: [`/${locale}/blog/${slug}/og.png`],
    },
    alternates: {
      canonical: `/${locale}/blog/${slug}`,
      languages,
    },
  };
}

export default async function BlogPostPage({ params }: Props): Promise<React.ReactNode> {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }
  const typed: Locale = locale;
  const post = await fetchPublishedPostBySlug(slug, typed);
  if (!post) {
    notFound();
  }
  const localesAvailable = await listLocalesForSlug(slug);
  const date = post.publishedAt ? new Date(post.publishedAt) : null;

  return (
    <article className="post container">
      <header className="post__header">
        <p className="eyebrow">
          {date
            ? date.toLocaleDateString(typed, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : '—'}
        </p>
        <h1 className="post__title">{post.title}</h1>
        {post.excerpt ? <p className="post__lede">{post.excerpt}</p> : null}
        <p className="post__byline">By {post.author}</p>
        {post.tags.length > 0 && (
          <ul className="post__tags">
            {post.tags.map(tag => (
              <li key={tag} className="tag">
                {tag}
              </li>
            ))}
          </ul>
        )}
      </header>

      <section className="prose post__body">
        <LexicalRenderer data={post.body} />
      </section>

      {localesAvailable.length > 1 && (
        <footer className="post__locale-footer">
          <p className="eyebrow">Also available in</p>
          <ul>
            {SUPPORTED_LOCALES.filter(alt => alt !== typed && localesAvailable.includes(alt)).map(
              alt => (
                <li key={alt}>
                  <a href={`/${alt}/blog/${slug}`} hrefLang={alt}>
                    {alt.toUpperCase()}
                  </a>
                </li>
              ),
            )}
          </ul>
        </footer>
      )}
    </article>
  );
}
