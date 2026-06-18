import { createLogger } from '@contractor-ops/logger';
import { PostCard } from '@/components/blog/post-card';
import { Footer } from '@/components/footer';
import { Navbar } from '@/components/navbar';
import type { Locale } from '@/i18n';
import { defaultLocale, getTranslations, isValidLocale, TranslationProvider } from '@/i18n';
import { getPosts } from '@/lib/cms';

const log = createLogger({ service: 'landing-blog-tag' });

export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ tag: string }>> {
  return [{ tag: 'placeholder' }];
}

export default async function TagArchivePage({
  params,
}: {
  params: Promise<{ locale: string; tag: string }>;
}) {
  const { locale: localeParam, tag } = await params;
  const locale: Locale = isValidLocale(localeParam) ? localeParam : defaultLocale;
  const t = await getTranslations(locale);

  let posts: Awaited<ReturnType<typeof getPosts>>;
  try {
    posts = await getPosts({ locale, tag, limit: 30 });
  } catch (error) {
    log.warn({ err: error, tag, locale }, 'CMS unreachable for tag archive');
    posts = {
      docs: [],
      totalDocs: 0,
      totalPages: 0,
      page: 1,
      hasNextPage: false,
      hasPrevPage: false,
    };
  }

  return (
    <TranslationProvider translations={t} locale={locale}>
      <Navbar />
      {/* biome-ignore lint/correctness/useUniqueElementIds: stable skip-link target referenced by href="#main" in layout.tsx */}
      <main id="main" className="pt-32 pb-24">
        <section className="mx-auto max-w-3xl px-6 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
            Tag archive
          </p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            <span className="text-foreground/80">#</span>
            {tag}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {posts.totalDocs} {posts.totalDocs === 1 ? 'post' : 'posts'}
          </p>
        </section>

        <section className="mx-auto mt-12 max-w-5xl px-6">
          {posts.docs.length > 0 ? (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.docs.map(post => (
                <li key={post.id}>
                  <PostCard post={post} locale={locale} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-muted-foreground">No posts under this tag yet.</p>
          )}
        </section>
      </main>
      <Footer />
    </TranslationProvider>
  );
}
