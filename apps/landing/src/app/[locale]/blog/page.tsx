import { createLogger } from '@contractor-ops/logger';
import { BlurFade } from '@contractor-ops/ui/components/magic/blur-fade';
import Link from 'next/link';
import { PostCard } from '@/components/blog/post-card';
import { Footer } from '@/components/footer';
import { Navbar } from '@/components/navbar';
import type { Locale } from '@/i18n';
import { defaultLocale, getTranslations, isValidLocale, TranslationProvider } from '@/i18n';
import { getPosts, listCategories } from '@/lib/cms';

const log = createLogger({ service: 'landing-blog-index' });

export const dynamic = 'force-static';

export const metadata = {
  title: 'Blog — Contractor Ops',
  description:
    'Field notes, product updates, and finance-ops thinking from the Contractor Ops team.',
};

interface SearchParams {
  page?: string;
  category?: string;
  tag?: string;
  q?: string;
}

export default async function BlogIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { locale: localeParam } = await params;
  const sp = (await searchParams) ?? {};
  const locale: Locale = isValidLocale(localeParam) ? localeParam : defaultLocale;
  const t = await getTranslations(locale);

  const page = Number(sp.page ?? '1') || 1;

  let posts: Awaited<ReturnType<typeof getPosts>>;
  let categories: Awaited<ReturnType<typeof listCategories>>;
  try {
    [posts, categories] = await Promise.all([
      getPosts({ locale, page, category: sp.category, tag: sp.tag, search: sp.q }),
      listCategories(locale),
    ]);
  } catch (error) {
    log.warn({ err: error, locale }, 'CMS unreachable, falling back to empty blog index');
    posts = {
      docs: [],
      totalDocs: 0,
      totalPages: 0,
      page: 1,
      hasNextPage: false,
      hasPrevPage: false,
    };
    categories = [];
  }

  const [featured, ...rest] = posts.docs;

  return (
    <TranslationProvider translations={t} locale={locale}>
      <Navbar />
      <main id="main" className="pt-32 pb-24">
        <section className="mx-auto max-w-5xl px-6">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
            Field notes
          </p>
          <h1 className="mt-3 text-balance font-display text-display">Contractor Ops blog</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Finance ops, audit-survival tips, and the occasional rant about Excel. Updated when
            there is something worth saying.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-2">
            <FilterChip href={`/${locale}/blog`} active={!(sp.category || sp.tag)}>
              All
            </FilterChip>
            {categories.map(category => (
              <FilterChip
                key={category.id}
                href={`/${locale}/blog?category=${category.slug}`}
                active={sp.category === category.slug}>
                {category.name}
              </FilterChip>
            ))}
          </div>
        </section>

        {featured ? (
          <section className="mx-auto mt-16 max-w-5xl px-6">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Featured
            </p>
            <PostCard post={featured} locale={locale} />
          </section>
        ) : null}

        {rest.length > 0 ? (
          <section className="mx-auto mt-12 max-w-5xl px-6">
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((post, i) => (
                <li key={post.id}>
                  <BlurFade delay={i * 0.06} inView>
                    <PostCard post={post} locale={locale} />
                  </BlurFade>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          !featured && (
            <section className="mx-auto mt-16 max-w-3xl px-6 text-center text-muted-foreground">
              <p>No posts published yet for this locale. Check back soon.</p>
            </section>
          )
        )}

        {posts.totalPages > 1 ? (
          <nav className="mx-auto mt-16 flex max-w-3xl items-center justify-between px-6 text-sm">
            {posts.hasPrevPage ? (
              <Link
                href={{
                  pathname: `/${locale}/blog`,
                  query: { ...sp, page: String(page - 1) },
                }}
                className="rounded-full border border-border/60 px-4 py-2 hover:border-primary/50">
                ← Newer
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground">
              Page {posts.page} / {posts.totalPages}
            </span>
            {posts.hasNextPage ? (
              <Link
                href={{
                  pathname: `/${locale}/blog`,
                  query: { ...sp, page: String(page + 1) },
                }}
                className="rounded-full border border-border/60 px-4 py-2 hover:border-primary/50">
                Older →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </main>
      <Footer />
    </TranslationProvider>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors ${
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground'
      }`}>
      {children}
    </Link>
  );
}
