import { PostCard as SharedPostCard } from '@contractor-ops/ui/marketing';
import Link from 'next/link';
import type { ReactNode } from 'react';

import type { Locale } from '@/i18n/config';
import type { PublishedPostSummary } from '@/lib/payload-queries';

type Props = {
  post: PublishedPostSummary;
  locale: Locale;
};

function CmsPostLink({
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

export function PostCard({ post, locale }: Props): ReactNode {
  return (
    <SharedPostCard
      post={{
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        publishedAt: post.publishedAt,
        author: post.author,
        tags: post.tags,
      }}
      locale={locale}
      href={`/${locale}/blog/${post.slug}`}
      variant="simple"
      LinkComponent={CmsPostLink}
    />
  );
}
