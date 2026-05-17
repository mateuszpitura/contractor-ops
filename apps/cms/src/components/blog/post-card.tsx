import Link from 'next/link';
import type { ReactNode } from 'react';

import type { Locale } from '@/i18n/config';
import type { PublishedPostSummary } from '@/lib/payload-queries';

type Props = {
  post: PublishedPostSummary;
  locale: Locale;
};

export function PostCard({ post, locale }: Props): ReactNode {
  const date = post.publishedAt ? new Date(post.publishedAt) : null;
  return (
    <article className="post-card">
      <Link href={`/${locale}/blog/${post.slug}`} className="post-card__link">
        <p className="eyebrow">
          {date
            ? date.toLocaleDateString(locale, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : '—'}
        </p>
        <h2 className="post-card__title">{post.title}</h2>
        {post.excerpt && <p className="post-card__excerpt">{post.excerpt}</p>}
        <footer className="post-card__meta">
          <span className="post-card__byline">{post.author}</span>
          {post.tags.length > 0 && (
            <ul className="post-card__tags">
              {post.tags.slice(0, 3).map(tag => (
                <li key={tag} className="tag">
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </footer>
      </Link>
    </article>
  );
}
