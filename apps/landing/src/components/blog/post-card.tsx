'use client';

import { PostCard as SharedPostCard } from '@contractor-ops/ui/marketing';
import type { MarketingPostSummary } from '@contractor-ops/ui/marketing';
import { GlowingEffect } from '@contractor-ops/ui/components/ace/glowing-effect';
import Link from 'next/link';
import type { ReactNode } from 'react';

import type { CmsPostSummary } from '@/lib/cms';

interface PostCardProps {
  post: CmsPostSummary;
  locale: string;
}

function LandingPostLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function toMarketingPost(post: CmsPostSummary): MarketingPostSummary {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    publishedAt: post.publishedAt,
    coverImage: post.coverImage?.url
      ? { url: post.coverImage.url, alt: post.coverImage.alt }
      : null,
    categories: post.categories.map(category => ({
      id: category.id,
      name: category.name,
    })),
    readingTimeMinutes: post.readingTimeMinutes,
  };
}

export function PostCard({ post, locale }: PostCardProps) {
  const href = `/${locale}/blog/${post.slug}`;

  return (
    <div className="group relative isolate">
      <GlowingEffect spread={24} glow proximity={36} inactiveZone={0.3} disabled={false} />
      <SharedPostCard
        post={toMarketingPost(post)}
        locale={locale}
        href={href}
        variant="featured"
        LinkComponent={LandingPostLink}
        className="border-0 bg-transparent backdrop-blur-none"
      />
    </div>
  );
}
