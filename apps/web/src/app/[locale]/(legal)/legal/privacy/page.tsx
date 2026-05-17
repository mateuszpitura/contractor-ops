import { auth } from '@contractor-ops/auth';
import { prisma } from '@contractor-ops/db';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { resolvePrivacyRedirect } from './_resolve';

export const metadata: Metadata = {
  title: 'Privacy Notice — Contractor Ops',
};

interface PrivacyIndexPageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Phase 56 · Plan 07 — /legal/privacy index.
 *
 * Authenticated users are redirected to the jurisdiction-specific notice
 * derived server-side from their active organisation's countryCode
 * (D-09 fallback: unknown -> /legal/privacy/eu). Unauthenticated or
 * org-less visitors see a jurisdiction picker with three cards.
 *
 * The redirect intentionally happens here (not on `[jurisdiction]/page.tsx`)
 * so direct visits to `/legal/privacy/{gb,de,eu}` remain accessible for
 * audit / legal review purposes — jurisdiction enforcement at the PDF
 * level is handled in `packages/api/src/routers/legal.ts`.
 */
export default async function PrivacyIndexPage({ params }: PrivacyIndexPageProps) {
  const { locale } = await params;
  const [session, t] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getTranslations('Legal'),
  ]);

  if (session?.session.activeOrganizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: session.session.activeOrganizationId },
      select: { countryCode: true },
    });
    const target = resolvePrivacyRedirect({ countryCode: org?.countryCode ?? null });
    redirect(`/${locale}${target}`);
  }

  return (
    <div className="mx-auto w-full max-w-4xl py-12">
      <header className="mb-10">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">
          {t('privacyIndex.heading')}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{t('privacyIndex.description')}</p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-3">
        {(
          [
            {
              slug: 'gb',
              label: t('privacyIndex.jurisdictions.gb.label'),
              subtitle: t('privacyIndex.jurisdictions.gb.subtitle'),
            },
            {
              slug: 'de',
              label: t('privacyIndex.jurisdictions.de.label'),
              subtitle: t('privacyIndex.jurisdictions.de.subtitle'),
            },
            {
              slug: 'eu',
              label: t('privacyIndex.jurisdictions.eu.label'),
              subtitle: t('privacyIndex.jurisdictions.eu.subtitle'),
            },
          ] as const
        ).map(jurisdiction => (
          <li key={jurisdiction.slug}>
            <Link
              href={`/legal/privacy/${jurisdiction.slug}`}
              className="group flex h-full min-h-[132px] flex-col justify-between rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <p className="text-base font-semibold text-card-foreground">{jurisdiction.label}</p>
              <p className="mt-3 text-sm text-muted-foreground">{jurisdiction.subtitle}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
