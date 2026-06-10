import type { ComponentType, ReactNode } from 'react';

import { cn } from '../lib/utils.js';
import { formatPostDate } from './format-post-date.js';
import type { MarketingPostSummary } from './post-summary.js';

export type MarketingPostLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

export type PostCardProps = {
  post: MarketingPostSummary;
  locale: string;
  href: string;
  className?: string;
  /** CMS-style class hooks vs landing Tailwind card chrome. */
  variant?: 'simple' | 'featured';
  LinkComponent?: ComponentType<MarketingPostLinkProps>;
};

function DefaultLink({ href, className, children }: MarketingPostLinkProps) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

function PostCardTags({ tags, max = 3 }: { tags: string[]; max?: number }) {
  if (tags.length === 0) return null;
  return (
    <ul className="post-card__tags flex flex-wrap gap-1">
      {tags.slice(0, max).map(tag => (
        <li key={tag} className="tag rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
          {tag}
        </li>
      ))}
    </ul>
  );
}

function SimplePostCard({
  post,
  locale,
  href,
  Link,
}: {
  post: MarketingPostSummary;
  locale: string;
  href: string;
  Link: ComponentType<MarketingPostLinkProps>;
}) {
  const tags = post.tags ?? [];
  const author = post.author ?? post.authors?.[0]?.name ?? null;

  return (
    <article className="post-card">
      <Link href={href} className="post-card__link">
        <p className="eyebrow">{formatPostDate(post.publishedAt, locale)}</p>
        <h2 className="post-card__title">{post.title}</h2>
        {post.excerpt ? <p className="post-card__excerpt">{post.excerpt}</p> : null}
        <footer className="post-card__meta">
          {author ? <span className="post-card__byline">{author}</span> : null}
          <PostCardTags tags={tags} />
        </footer>
      </Link>
    </article>
  );
}

function FeaturedPostCard({
  post,
  locale,
  href,
  Link,
  className,
}: {
  post: MarketingPostSummary;
  locale: string;
  href: string;
  Link: ComponentType<MarketingPostLinkProps>;
  className?: string;
}) {
  const categories = post.categories ?? [];
  const dateLabel = formatPostDate(post.publishedAt, locale);
  const cover = post.coverImage;

  return (
    <article
      className={cn(
        'group relative isolate overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur transition-colors hover:border-primary/40',
        className,
      )}>
      <Link href={href} className="block focus-visible:outline-none">
        {cover?.url ? (
          <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
            <img
              src={cover.url}
              alt={cover.alt ?? post.title}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-[16/9] w-full bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
        )}
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {categories.slice(0, 2).map(category => (
              <span
                key={String(category.id)}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                {category.name}
              </span>
            ))}
            {post.publishedAt ? (
              <time dateTime={new Date(post.publishedAt).toISOString()}>{dateLabel}</time>
            ) : null}
            {post.readingTimeMinutes ? <span>· {post.readingTimeMinutes} min</span> : null}
          </div>
          <h3 className="mt-3 line-clamp-2 text-lg font-semibold tracking-tight text-foreground group-hover:text-primary">
            {post.title}
          </h3>
          {post.excerpt ? (
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {post.excerpt}
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}

export function PostCard({
  post,
  locale,
  href,
  className,
  variant = 'simple',
  LinkComponent,
}: PostCardProps): ReactNode {
  const Link = LinkComponent ?? DefaultLink;

  if (variant === 'featured') {
    return (
      <FeaturedPostCard post={post} locale={locale} href={href} Link={Link} className={className} />
    );
  }

  return <SimplePostCard post={post} locale={locale} href={href} Link={Link} />;
}
