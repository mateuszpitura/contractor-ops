import { createLogger } from '@contractor-ops/logger';
import { notFound } from 'next/navigation';
import { PostCard } from '@/components/blog/post-card';
import { Footer } from '@/components/footer';
import { Navbar } from '@/components/navbar';
import type { Locale } from '@/i18n';
import { defaultLocale, getTranslations, isValidLocale, TranslationProvider } from '@/i18n';
import { getAuthor, getPosts } from '@/lib/cms';
import { sanitizeHref } from '@/lib/sanitize-href';

const log = createLogger({ service: 'landing-blog-author' });

export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ handle: string }>> {
  return [{ handle: 'placeholder' }];
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ locale: string; handle: string }>;
}) {
  const { locale: localeParam, handle } = await params;
  const locale: Locale = isValidLocale(localeParam) ? localeParam : defaultLocale;
  let author: Awaited<ReturnType<typeof getAuthor>> = null;
  let posts: Awaited<ReturnType<typeof getPosts>> | null = null;
  try {
    [author, posts] = await Promise.all([
      getAuthor({ handle, locale }),
      getPosts({ locale, authorHandle: handle, limit: 30 }),
    ]);
  } catch (error) {
    log.warn({ err: error, handle, locale }, 'CMS unreachable for author page');
    author = null;
    posts = null;
  }
  if (!author) {
    notFound();
  }
  const t = await getTranslations(locale);

  return (
    <TranslationProvider translations={t} locale={locale}>
      <Navbar />
      {/* biome-ignore lint/correctness/useUniqueElementIds: stable skip-link target referenced by href="#main" in layout.tsx */}
      <main id="main" className="pt-32 pb-24">
        <section className="mx-auto max-w-3xl px-6 text-center">
          <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 via-primary/10 to-transparent text-2xl font-semibold">
            {author.name
              .split(' ')
              .map(n => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            {author.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">@{author.handle}</p>
          {author.socials && author.socials.length > 0 ? (
            <ul className="mt-4 flex flex-wrap justify-center gap-3">
              {author.socials.map(social => {
                const safeUrl = sanitizeHref(social.url);
                if (safeUrl === '#') {
                  return null;
                }
                return (
                  <li key={social.url}>
                    <a
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-primary">
                      {social.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>

        <section className="mx-auto mt-16 max-w-5xl px-6">
          {posts && posts.docs.length > 0 ? (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.docs.map(post => (
                <li key={post.id}>
                  <PostCard post={post} locale={locale} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-muted-foreground">No posts from this author yet.</p>
          )}
        </section>
      </main>
      <Footer />
    </TranslationProvider>
  );
}
