import { cn } from '@contractor-ops/ui/lib/utils';
import { Footer } from '@/components/footer';
import { Navbar } from '@/components/navbar';
import { CtaBand } from '@/components/sections';
import type { Locale } from '@/i18n';
import { defaultLocale, getTranslations, isValidLocale, TranslationProvider } from '@/i18n';
import type { ChangelogTag } from '@/lib/changelog';
import { changelog } from '@/lib/changelog';

export const metadata = {
  title: 'Changelog — Contractor Ops',
  description: 'Release notes and product updates for Contractor Ops.',
};

// Light-mode chips need a dark foreground to hit 4.5:1 contrast against the
// translucent tinted background; dark-mode override flips to the lighter shade.
const TAG_STYLES: Record<ChangelogTag, string> = {
  feature: 'bg-emerald-500/15 text-emerald-800 ring-emerald-400/30 dark:text-emerald-200',
  fix: 'bg-sky-500/15 text-sky-800 ring-sky-400/30 dark:text-sky-200',
  breaking: 'bg-amber-500/15 text-amber-800 ring-amber-400/30 dark:text-amber-100',
  security: 'bg-rose-500/15 text-rose-800 ring-rose-400/30 dark:text-rose-100',
};

export default async function ChangelogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale: Locale = isValidLocale(localeParam) ? localeParam : defaultLocale;
  const t = await getTranslations(locale);

  return (
    <TranslationProvider translations={t} locale={locale}>
      <Navbar />
      <main id="main" className="pt-32">
        <section className="mx-auto max-w-3xl px-6 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Changelog</p>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight md:text-6xl">
            Every release, in plain English.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Subscribe to the RSS feed if you would rather not check this page. We never ship
            breaking changes without naming them.
          </p>
          <a
            href={`/${locale}/changelog/rss.xml`}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            RSS feed →
          </a>
        </section>

        <section className="mx-auto mt-16 max-w-3xl px-6">
          <ol className="relative border-s border-border/40 ps-6">
            {changelog.map(entry => (
              <li key={entry.version} className="relative mb-10 last:mb-0">
                <span className="absolute -start-[7px] top-1.5 inline-flex h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                <header className="flex flex-wrap items-baseline gap-3">
                  <h2 className="text-xl font-semibold tracking-tight">{entry.version}</h2>
                  <time dateTime={entry.date} className="text-sm text-muted-foreground">
                    {entry.date}
                  </time>
                  <div className="flex flex-wrap gap-1.5">
                    {entry.tags.map(tag => (
                      <span
                        key={tag}
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ring-1 ring-inset',
                          TAG_STYLES[tag],
                        )}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </header>
                <h3 className="mt-2 text-base font-medium text-foreground">{entry.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {entry.summary}
                </p>
                {entry.bullets ? (
                  <ul className="mt-3 list-disc space-y-1 ps-5 text-sm leading-relaxed text-muted-foreground">
                    {entry.bullets.map(bullet => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        <div className="section-divider mt-24" />
        <CtaBand
          label={t.ctaBand.label}
          headline={t.ctaBand.headline}
          headlineHighlight={t.ctaBand.headlineHighlight}
          description={t.ctaBand.description}
          ctaPrimary={t.ctaBand.ctaPrimary}
          ctaSecondary={t.ctaBand.ctaSecondary}
        />
      </main>
      <Footer />
    </TranslationProvider>
  );
}
