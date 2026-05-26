'use client';

import { DirectionAwareHover } from '@contractor-ops/ui/components/ace/direction-aware-hover';
import { GlowingEffect } from '@contractor-ops/ui/components/ace/glowing-effect';
import Link from 'next/link';
import type { CmsPostSummary } from '@/lib/cms';

interface PostCardProps {
  post: CmsPostSummary;
  locale: string;
}

export function PostCard({ post, locale }: PostCardProps) {
  const href = `/${locale}/blog/${post.slug}`;
  const date = post.publishedAt ? new Date(post.publishedAt) : null;

  return (
    <article className="group relative isolate overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur transition-colors hover:border-primary/40">
      <GlowingEffect spread={24} glow proximity={36} inactiveZone={0.3} disabled={false} />
      <Link href={href} className="block focus-visible:outline-none">
        {post.coverImage?.url ? (
          <DirectionAwareHover
            imageUrl={post.coverImage.url}
            className="aspect-[16/9] w-full h-auto rounded-none"
            imageClassName="object-cover">
            <span className="sr-only">{post.coverImage.alt ?? post.title}</span>
          </DirectionAwareHover>
        ) : (
          <div className="aspect-[16/9] w-full bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
        )}
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {post.categories.slice(0, 2).map(category => (
              <span
                key={category.id}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                {category.name}
              </span>
            ))}
            {date ? (
              <time dateTime={date.toISOString()}>{date.toLocaleDateString(locale)}</time>
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
