import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PostCard } from '@/components/blog/post-card';
import type { Locale } from '@/i18n/config';
import { isSupportedLocale, SUPPORTED_LOCALES } from '@/i18n/config';
import { fetchPublishedPosts } from '@/lib/payload-queries';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Articles',
    description: 'Every Contractor-Ops article, sorted by most recent.',
    alternates: {
      canonical: `/${locale}/blog`,
      languages: Object.fromEntries(SUPPORTED_LOCALES.map(alt => [alt, `/${alt}/blog`])),
    },
  };
}

export default async function BlogIndexPage({
  params,
  searchParams,
}: Props): Promise<React.ReactNode> {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;

  if (!isSupportedLocale(locale)) {
    notFound();
  }
  const typed: Locale = locale;

  const requestedPage = pageParam ? Number.parseInt(pageParam, 10) : 1;
  const safePage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const { docs, totalPages, page, hasNextPage, hasPrevPage } = await fetchPublishedPosts({
    locale: typed,
    page: safePage,
    limit: 10,
  });

  return (
    <div className="container blog-index">
      <header className="page-header">
        <p className="eyebrow">Articles</p>
        <h1>Everything we&apos;ve written</h1>
        <p className="page-header__lede">
          {docs.length === 0
            ? 'No published articles yet in this language.'
            : `Page ${page} of ${Math.max(1, totalPages)}.`}
        </p>
      </header>

      {docs.length > 0 && (
        <ul className="post-grid">
          {docs.map(post => (
            <li key={post.id}>
              <PostCard post={post} locale={typed} />
            </li>
          ))}
        </ul>
      )}

      {(hasPrevPage || hasNextPage) && (
        <nav className="pagination" aria-label="Pagination">
          {hasPrevPage && (
            <Link
              href={page - 1 === 1 ? `/${typed}/blog` : `/${typed}/blog?page=${page - 1}`}
              rel="prev">
              ← Newer
            </Link>
          )}
          <span className="pagination__current" aria-current="page">
            {page} / {Math.max(1, totalPages)}
          </span>
          {hasNextPage && (
            <Link href={`/${typed}/blog?page=${page + 1}`} rel="next">
              Older →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
