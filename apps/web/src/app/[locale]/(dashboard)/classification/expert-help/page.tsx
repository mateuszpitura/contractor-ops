// apps/web/src/app/[locale]/(dashboard)/classification/expert-help/page.tsx
//
// Phase 64 · D-20 — "Get Expert Help" adviser referral page (LEGAL-04).
//
// Jurisdiction-aware: reads org.countryCode from session.
//   GB: CIOT-accredited advisers link + HMRC IR35 guidance + disclaimer
//   DE: Steuerberaterkammer chambers link + DRV Statusfeststellungsverfahren guide + disclaimer
//
// Flag-gated via the classification layout.tsx (Plan 64-05) — already inside
// the classification route group that calls notFound() when flag off.
//
// Optional org-level expert referral email: if Organization.expertReferralEmail
// is set, an additional "Contact our adviser" card is shown.

import { auth } from '@contractor-ops/auth';
import { prisma } from '@contractor-ops/db';
import {
  SOFTWARE_NOT_LEGAL_ADVICE_DE,
  SOFTWARE_NOT_LEGAL_ADVICE_EN,
} from '@contractor-ops/validators';
import { ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

export const metadata: Metadata = {
  title: 'Get Expert Help — Classification — Contractor Ops',
};

export default async function ExpertHelpPage({
  searchParams,
}: {
  searchParams: Promise<{ assessmentId?: string }>;
}) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) notFound();

  const org = await prisma.organization.findFirst({
    where: { id: session.session.activeOrganizationId },
    select: { countryCode: true, expertReferralEmail: true },
  });

  const { assessmentId } = await searchParams;
  const t = await getTranslations('Classification.ExpertHelp');
  const isDE = org?.countryCode === 'DE';
  const softwareNotLegalAdvice = isDE ? SOFTWARE_NOT_LEGAL_ADVICE_DE : SOFTWARE_NOT_LEGAL_ADVICE_EN;

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Org-level custom adviser card (opt-in, D-20) */}
      {!!org?.expertReferralEmail && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-semibold">{t('orgAdviser.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('orgAdviser.description')}</p>
          <a
            href={`mailto:${org.expertReferralEmail}${assessmentId ? `?subject=IR35 Classification Query - Assessment ${assessmentId}` : ''}`}
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-900">
            {t('orgAdviser.contact')}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      )}

      {/* Jurisdiction-specific adviser directories */}
      {isDE ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('de.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('de.description')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <a
              href="https://www.bstbk.de/de/mitgliedschaft/kammern"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border p-4 hover:bg-muted/50">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">{t('de.steuerberater.title')}</div>
                <div className="text-sm text-muted-foreground">
                  {t('de.steuerberater.description')}
                </div>
              </div>
            </a>
            <a
              href="https://www.deutsche-rentenversicherung.de/DRV/DE/Beitragszahler/Arbeitgeber-und-Steuerberater/Statusfeststellung/statusfeststellung_node.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border p-4 hover:bg-muted/50">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">{t('de.drv.title')}</div>
                <div className="text-sm text-muted-foreground">{t('de.drv.description')}</div>
              </div>
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('gb.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('gb.description')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <a
              href="https://www.tax.org.uk/find-tax-adviser"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border p-4 hover:bg-muted/50">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">{t('gb.ciot.title')}</div>
                <div className="text-sm text-muted-foreground">{t('gb.ciot.description')}</div>
              </div>
            </a>
            <a
              href="https://www.gov.uk/hmrc-internal-manuals/employment-status-manual"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border p-4 hover:bg-muted/50">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">{t('gb.hmrc.title')}</div>
                <div className="text-sm text-muted-foreground">{t('gb.hmrc.description')}</div>
              </div>
            </a>
          </div>
        </div>
      )}

      {/* Software not legal advice disclaimer */}
      <div className="rounded-lg border border-muted bg-muted/20 p-4">
        <p className="text-xs text-muted-foreground">{softwareNotLegalAdvice}</p>
      </div>
    </div>
  );
}
