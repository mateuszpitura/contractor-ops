import { Footer } from '@/components/footer';
import { Navbar } from '@/components/navbar';
import { CtaBand } from '@/components/sections';
import type { Locale } from '@/i18n';
import { defaultLocale, getTranslations, isValidLocale, TranslationProvider } from '@/i18n';

export const metadata = {
  title: 'About — Contractor Ops',
  description:
    'A small EU-based team building the system of record for B2B contractor operations across the EU and Middle East.',
};

const team: ReadonlyArray<{ name: string; role: string; bio: string }> = [
  {
    name: 'Mateusz Pitura',
    role: 'Founder & CEO',
    bio: 'Ex-CFO. Spent a decade reconciling contractor invoices in spreadsheets. Refused to do it once more.',
  },
  {
    name: 'Lena Hofmann',
    role: 'Head of Product',
    bio: 'Built finance ops tools at three different SaaS companies. Knows where the bodies are buried.',
  },
  {
    name: 'Daniel Okafor',
    role: 'Founding Engineer',
    bio: 'Distributed systems at scale, then small teams shipping fast. Champion of boring infrastructure.',
  },
  {
    name: 'Hanna Lindgren',
    role: 'Design',
    bio: 'Editorial layout snob. Believes operational tools deserve the same craft as consumer products.',
  },
];

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale: Locale = isValidLocale(localeParam) ? localeParam : defaultLocale;
  const t = await getTranslations(locale);

  return (
    <TranslationProvider translations={t} locale={locale}>
      <Navbar />
      <main id="main" className="pt-32">
        <section className="mx-auto max-w-3xl px-6 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">About</p>
          <h1 className="mt-4 text-balance font-display text-display">
            Operational software, built like an editorial product.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Contractor Ops is the system of record for finance teams managing 5–50 B2B contractors
            across the EU and Middle East. We replace spreadsheets, email chains and brittle Zapier
            integrations with one calm command surface.
          </p>
        </section>

        <section className="mx-auto mt-20 grid max-w-5xl gap-6 px-6 sm:grid-cols-2 lg:grid-cols-4">
          {team.map(member => (
            <article
              key={member.name}
              className="group relative isolate overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur transition-colors hover:border-primary/40">
              <div className="h-32 w-32 rounded-full bg-gradient-to-br from-primary/20 via-primary/5 to-transparent" />
              <h2 className="mt-5 text-base font-semibold">{member.name}</h2>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {member.role}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{member.bio}</p>
            </article>
          ))}
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
