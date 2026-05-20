import { Fingerprint, Key, Lock, Receipt, ShieldCheck } from 'lucide-react';
import { Footer } from '@/components/footer';
import { Navbar } from '@/components/navbar';
import { CtaBand, FaqSection } from '@/components/sections';
import type { Locale } from '@/i18n';
import { defaultLocale, getTranslations, isValidLocale, TranslationProvider } from '@/i18n';

export const metadata = {
  title: 'Security & Trust — Contractor Ops',
  description:
    'How Contractor Ops handles your data: encryption, access control, residency, audit trail.',
};

const badges = [
  { icon: ShieldCheck, label: 'GDPR aligned', detail: 'Article 28 DPA on request.' },
  { icon: Key, label: 'SSO + 2FA', detail: 'Better Auth + TOTP on every account.' },
  { icon: Lock, label: 'AES-256 at rest', detail: 'Postgres + S3 envelope encryption.' },
  { icon: Fingerprint, label: 'Audit-grade log', detail: 'Signed + timestamped action stream.' },
  { icon: Receipt, label: 'Region-pinned data', detail: 'EU + ME multi-region; pick yours.' },
];

const trustFaq = [
  {
    question: 'Where is my data stored?',
    answer:
      'You pick a region at sign-up. EU customers are pinned to Frankfurt; Middle East customers to Bahrain. We do not cross-replicate jurisdictions.',
  },
  {
    question: 'How do you handle PII?',
    answer:
      'Field-level encryption on Personally Identifiable fields (tax IDs, IBANs, addresses). Internal access uses a least-privilege role model with read-only review by default.',
  },
  {
    question: 'Do you publish a status page?',
    answer:
      'Yes — status.contractor-ops.io. Last 90-day uptime, current incidents, and a subscribable webhook.',
  },
  {
    question: 'Who has access to my workspace?',
    answer:
      'Only seats you explicitly invite. Support has zero standing access; debug sessions require your one-time consent and produce an audit-log entry.',
  },
  {
    question: 'Can I export everything?',
    answer:
      'Yes. CSV + JSON archive with embedded PDF copies of contracts and invoices. Available from Settings → Data → Export.',
  },
];

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale: Locale = isValidLocale(localeParam) ? localeParam : defaultLocale;
  const t = await getTranslations(locale);

  return (
    <TranslationProvider translations={t} locale={locale}>
      <Navbar />
      <main className="pt-32">
        <section className="mx-auto max-w-3xl px-6 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Trust</p>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight md:text-6xl">
            Your data. Pinned, signed, and exportable.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            We treat operational data the way you would: encrypted, region-locked, and ready to
            leave with you on day one. Here is what that means in practice.
          </p>
        </section>

        <section className="mx-auto mt-20 grid max-w-5xl gap-4 px-6 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map(badge => {
            const Icon = badge.icon;
            return (
              <article
                key={badge.label}
                className="rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon aria-hidden className="size-5" />
                </span>
                <h2 className="mt-5 text-base font-semibold">{badge.label}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{badge.detail}</p>
              </article>
            );
          })}
        </section>

        <div className="section-divider mt-24" />

        <FaqSection
          label="Trust FAQ"
          headline="What about"
          headlineHighlight="the rest"
          description="The specifics auditors and security teams reach for first."
          items={trustFaq}
        />

        <div className="section-divider" />
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
