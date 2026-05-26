import { Check, X } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/footer';
import { Navbar } from '@/components/navbar';
import { CtaBand } from '@/components/sections';
import type { Locale } from '@/i18n';
import { defaultLocale, getTranslations, isValidLocale, TranslationProvider } from '@/i18n';
import { COMPETITORS } from '@/lib/competitors';

export function generateStaticParams() {
  return Object.keys(COMPETITORS).map(competitor => ({ competitor }));
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ locale: string; competitor: string }>;
}) {
  const { locale: localeParam, competitor } = await params;
  const locale: Locale = isValidLocale(localeParam) ? localeParam : defaultLocale;
  const config = COMPETITORS[competitor];
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
            Heads-up comparison
          </p>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight md:text-6xl">
            Contractor Ops vs <span className="text-foreground/80">{config.name}</span>
          </h1>
          <p className="mt-3 text-lg italic text-muted-foreground">{config.tagline}</p>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {config.positioning}
          </p>
        </section>

        <section className="mx-auto mt-16 max-w-5xl px-6">
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur">
            <table className="w-full text-left">
              <thead className="bg-background/40 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-6 py-4">
                    Capability
                  </th>
                  <th scope="col" className="sticky end-0 bg-primary/10 px-6 py-4 text-primary">
                    Contractor Ops
                  </th>
                  <th scope="col" className="px-6 py-4">
                    {config.name}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {config.rows.map(row => (
                  <tr key={row.feature} className="text-sm">
                    <th scope="row" className="px-6 py-4 font-medium text-foreground">
                      {row.feature}
                    </th>
                    <Cell value={row.contractorOps} highlight />
                    <Cell value={row.competitor} />
                  </tr>
                ))}
              </tbody>
            </table>
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

function Cell({ value, highlight = false }: { value: string | boolean; highlight?: boolean }) {
  const className = highlight ? 'bg-primary/5 px-6 py-4' : 'px-6 py-4 text-muted-foreground';
  if (typeof value === 'boolean') {
    return (
      <td className={className}>
        {value ? (
          <Check aria-label="Yes" className="size-5 text-emerald-400" />
        ) : (
          <X aria-label="No" className="size-5 text-rose-400" />
        )}
      </td>
    );
  }
  return <td className={className}>{value}</td>;
}
