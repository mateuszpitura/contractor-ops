import { createLogger } from '@contractor-ops/logger';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { extractHeadings, LexicalBody } from '@/components/blog/lexical-body';
import { NewsletterCta } from '@/components/blog/newsletter-cta';
import { PostCard } from '@/components/blog/post-card';
import { Reactions } from '@/components/blog/reactions';
import { ReadingProgress } from '@/components/blog/reading-progress';
import { ShareDropdown } from '@/components/blog/share-dropdown';
import { Toc } from '@/components/blog/toc';
import { Footer } from '@/components/footer';
import { Navbar } from '@/components/navbar';
import type { Locale } from '@/i18n';
import { defaultLocale, getTranslations, isValidLocale, TranslationProvider } from '@/i18n';
import type { CmsPostSummary } from '@/lib/cms';
import { getPost, getRelatedPosts } from '@/lib/cms';

export const dynamic = 'force-static';
export const dynamicParams = false;

const log = createLogger({ service: 'landing-blog-post' });

// CMS is not reachable at landing build time. Pre-render no slugs; populate
// via a build-time CMS fetch once apps/landing leaves static-export mode (or
// blog routes relocate to apps/cms per the headless-blog-cms goal).
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return [{ slug: 'placeholder' }];
}

const SITE_URL = process.env.NEXT_PUBLIC_LANDING_URL ?? 'https://contractor-ops.io';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: localeParam, slug } = await params;
  const locale: Locale = isValidLocale(localeParam) ? localeParam : defaultLocale;
  try {
    const post = await getPost({ slug, locale });
    if (!post) {
      return { title: 'Post not found' };
    }
    return {
      title: post.seo?.title ?? post.title,
      description: post.seo?.description ?? post.excerpt ?? undefined,
    };
  } catch (error) {
    log.warn({ err: error, slug, locale }, 'CMS unreachable for metadata');
    return { title: 'Post not found' };
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: localeParam, slug } = await params;
  const locale: Locale = isValidLocale(localeParam) ? localeParam : defaultLocale;
  let post: Awaited<ReturnType<typeof getPost>> = null;
  try {
    post = await getPost({ slug, locale });
  } catch (error) {
    log.warn({ err: error, slug, locale }, 'CMS unreachable, rendering not-found');
    post = null;
  }
  if (!post) {
    notFound();
  }
  const t = await getTranslations(locale);

  let related: readonly CmsPostSummary[] = [];
  try {
    related = await getRelatedPosts({
      postId: post.id,
      categorySlug: post.categories[0]?.slug,
      locale,
      limit: 3,
    });
  } catch (error) {
    log.warn({ err: error, postId: post.id }, 'CMS unreachable for related posts');
    related = [];
  }

  const publishedAt = post.publishedAt ? new Date(post.publishedAt) : null;
  const url = `${SITE_URL}/${locale}/blog/${post.slug}`;

  return (
    <TranslationProvider translations={t} locale={locale}>
      <ReadingProgress />
      <Navbar />
      {/* biome-ignore lint/correctness/useUniqueElementIds: stable skip-link target referenced by href="#main" in layout.tsx */}
      <main id="main" className="pt-28 pb-24">
        <article className="mx-auto max-w-3xl px-6">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
            <ol className="flex items-center gap-2">
              <li>
                <Link href={`/${locale}/blog`} className="hover:text-foreground">
                  Blog
                </Link>
              </li>
              {post.categories[0] ? (
                <>
                  <li aria-hidden>/</li>
                  <li>
                    <Link
                      href={`/${locale}/blog?category=${post.categories[0].slug}`}
                      className="hover:text-foreground">
                      {post.categories[0].name}
                    </Link>
                  </li>
                </>
              ) : null}
            </ol>
          </nav>

          <header>
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {post.categories.slice(0, 3).map(category => (
                <Link
                  key={category.id}
                  href={`/${locale}/blog?category=${category.slug}`}
                  className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                  {category.name}
                </Link>
              ))}
              {publishedAt ? (
                <time dateTime={publishedAt.toISOString()}>
                  {publishedAt.toLocaleDateString(locale)}
                </time>
              ) : null}
              {post.readingTimeMinutes ? <span>· {post.readingTimeMinutes} min read</span> : null}
            </div>
            <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
              {post.title}
            </h1>
            {post.excerpt ? (
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{post.excerpt}</p>
            ) : null}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <ul className="flex items-center gap-3">
                {post.authors.map(author => (
                  <li key={author.id} className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 via-primary/10 to-transparent text-sm font-semibold">
                      {author.name
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <Link
                      href={`/${locale}/blog/author/${author.handle}`}
                      className="text-sm font-medium text-foreground hover:text-primary">
                      {author.name}
                    </Link>
                  </li>
                ))}
              </ul>
              <ShareDropdown url={url} title={post.title} />
            </div>
          </header>

          {post.heroImage?.url ? (
            <div className="relative mt-10 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-border/60">
              <Image
                src={post.heroImage.url}
                alt={post.heroImage.alt ?? ''}
                fill
                priority
                sizes="(min-width: 768px) 768px, 100vw"
                className="object-cover"
              />
            </div>
          ) : null}

          <div className="mt-12 grid gap-10 lg:grid-cols-[1fr,14rem]">
            <LexicalBody body={post.body} className="leading-relaxed" />
            <aside className="hidden lg:block">
              <div className="sticky top-28">
                <Toc headings={extractHeadings(post.body)} />
              </div>
            </aside>
          </div>

          <div className="mt-12 flex flex-col items-start gap-6 border-t border-border/40 pt-8 md:flex-row md:items-center md:justify-between">
            <Reactions postId={post.id} />
            <ShareDropdown url={url} title={post.title} />
          </div>

          <div className="mt-12">
            <NewsletterCta
              headline={t.footer.newsletter.headline}
              description={t.footer.newsletter.description}
              placeholder={t.footer.newsletter.placeholder}
              submit={t.footer.newsletter.submit}
              success={t.footer.newsletter.success}
            />
          </div>

          {related.length > 0 ? (
            <section className="mt-16">
              <h2 className="mb-6 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Keep reading
              </h2>
              <ul className="grid gap-6 sm:grid-cols-3">
                {related.map(rel => (
                  <li key={rel.id}>
                    <PostCard post={rel} locale={locale} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>
      </main>
      <Footer />
    </TranslationProvider>
  );
}
