import { notFound } from 'next/navigation';
import { Footer } from '@/components/footer';
import { Navbar } from '@/components/navbar';
import { CtaBand } from '@/components/sections';
import type { Locale } from '@/i18n';
import { defaultLocale, getTranslations, isValidLocale, TranslationProvider } from '@/i18n';

interface SolutionConfig {
  hero: { eyebrow: string; headline: string; subheadline: string };
  pains: ReadonlyArray<{ title: string; description: string }>;
  workflow: ReadonlyArray<{ step: string; title: string; description: string }>;
  gallery: ReadonlyArray<{ caption: string }>;
}

const SOLUTIONS: Record<string, SolutionConfig> = {
  'general-contractor': {
    hero: {
      eyebrow: 'For general contractors',
      headline: 'Run subcontractor ops without losing a margin point.',
      subheadline:
        'Onboard subcontractors, gate invoices behind purchase orders, and pay weekly without leaving one tab.',
    },
    pains: [
      {
        title: 'Spreadsheet sprawl',
        description: 'Four Excel files per project, three of them out of date.',
      },
      {
        title: 'Late invoice surprises',
        description: 'Subcontractors invoice 14 days after the work was done.',
      },
      {
        title: 'Audit panic season',
        description: 'Six weeks per year reconstructing payments for the auditor.',
      },
    ],
    workflow: [
      {
        step: '01',
        title: 'Bring contractors',
        description: 'CSV import or invite-link. Pre-fill known data.',
      },
      {
        step: '02',
        title: 'Bind to projects',
        description: 'Project budget visible. PO required for payment.',
      },
      {
        step: '03',
        title: 'Approve invoices',
        description: 'OCR auto-match. Bulk approve. Audit log baked in.',
      },
      { step: '04', title: 'Pay in one run', description: 'Weekly bulk payment via SEPA / SWIFT.' },
    ],
    gallery: [
      { caption: 'Project margin dashboard' },
      { caption: 'PO-match invoice queue' },
      { caption: 'Weekly payment run' },
    ],
  },
  subcontractor: {
    hero: {
      eyebrow: 'For subcontractors',
      headline: 'Get paid faster. Send fewer reminder emails.',
      subheadline:
        'Submit invoices in 30 seconds, see exactly where they sit in the approval flow, and watch your portal show paid status before the SMS arrives.',
    },
    pains: [
      {
        title: 'Where is my invoice?',
        description: 'Every approval is a Slack thread you can not see.',
      },
      {
        title: 'Wrong format = rejection',
        description: 'Some clients want PDF, some want Peppol, some both.',
      },
      {
        title: 'Late payment cycles',
        description: 'Net-30 quietly becomes net-45 when payments slip.',
      },
    ],
    workflow: [
      {
        step: '01',
        title: 'Sign once',
        description: 'A single contractor account; many client workspaces.',
      },
      {
        step: '02',
        title: 'Submit invoice',
        description: 'Drag-drop PDF or generate from a saved template.',
      },
      {
        step: '03',
        title: 'Watch the timeline',
        description: 'See approval stage, expected pay date, gating block.',
      },
      {
        step: '04',
        title: 'Receive payment',
        description: 'Auto-receipt + reconciled in your accounting tool.',
      },
    ],
    gallery: [
      { caption: 'Submission preview' },
      { caption: 'Approval timeline' },
      { caption: 'Cross-client portal' },
    ],
  },
  accountant: {
    hero: {
      eyebrow: 'For accountants & Steuerberater',
      headline: 'Stop transcribing PDFs. Pull audit-ready exports instead.',
      subheadline:
        'Read-only seats are free. Export DATEV-compatible bookkeeping packages on demand. End audit prep with a checkbox.',
    },
    pains: [
      {
        title: 'Hours of transcription',
        description: 'Manual data entry from PDFs into your ledger system.',
      },
      {
        title: 'Reconciliation guesswork',
        description: 'Bank statement entries that nobody can match to invoices.',
      },
      {
        title: 'Audit overhead',
        description: 'Reconstructing approval chains months after the fact.',
      },
    ],
    workflow: [
      {
        step: '01',
        title: 'Get invited',
        description: 'Read-only seat at your client workspace. Free seat.',
      },
      {
        step: '02',
        title: 'Browse the ledger',
        description: 'Invoices, payments, contracts — all signed + timestamped.',
      },
      {
        step: '03',
        title: 'Export package',
        description: 'DATEV CSV + PDF archive for the period.',
      },
      {
        step: '04',
        title: 'Close the period',
        description: 'Audit log proves every approval. Done.',
      },
    ],
    gallery: [
      { caption: 'DATEV export preview' },
      { caption: 'Approval audit trail' },
      { caption: 'Reconciliation ledger' },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(SOLUTIONS).map(role => ({ role }));
}

export default async function SolutionsPage({
  params,
}: {
  params: Promise<{ locale: string; role: string }>;
}) {
  const { locale: localeParam, role } = await params;
  const locale: Locale = isValidLocale(localeParam) ? localeParam : defaultLocale;
  const config = SOLUTIONS[role];
  if (!config) {
    notFound();
  }
  const t = await getTranslations(locale);

  return (
    <TranslationProvider translations={t} locale={locale}>
      <Navbar />
      <main id="main" className="pt-32">
        <section className="mx-auto max-w-3xl px-6 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
            {config.hero.eyebrow}
          </p>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight md:text-6xl">
            {config.hero.headline}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {config.hero.subheadline}
          </p>
        </section>

        <section className="mx-auto mt-20 max-w-5xl px-6">
          <h2 className="mb-8 text-center text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Pains we hear most
          </h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {config.pains.map(p => (
              <li
                key={p.title}
                className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur">
                <h3 className="text-base font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p.description}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto mt-20 max-w-5xl px-6">
          <h2 className="mb-8 text-center text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
            How it lands in your day
          </h2>
          <ol className="grid gap-4 md:grid-cols-4">
            {config.workflow.map(step => (
              <li
                key={step.step}
                className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur">
                <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
                  {step.step}
                </span>
                <h3 className="mt-3 text-base font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto mt-20 max-w-5xl px-6">
          <h2 className="mb-8 text-center text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Screens you will live in
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {config.gallery.map(g => (
              <figure
                key={g.caption}
                className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur">
                <div className="aspect-video bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
                <figcaption className="px-4 py-3 text-sm text-muted-foreground">
                  {g.caption}
                </figcaption>
              </figure>
            ))}
          </div>
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
