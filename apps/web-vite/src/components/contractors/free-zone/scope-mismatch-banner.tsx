import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { AlertTriangle } from 'lucide-react';

import { Link } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

export interface ScopeMismatchBannerProps {
  /**
   * Set by the contract-create result (`contract.permittedActivityScope.mismatch`,
   * Plan 05): the contract's ISIC activity falls outside the contractor's permitted
   * free-zone set. The banner is advisory only — it never gates creation (D-07).
   */
  mismatch: boolean;
  /**
   * Locale-less route to the affected engagement's compliance list, where the
   * auto-NOC item lives. The locale-aware `Link` prefixes `/:locale` automatically.
   */
  complianceHref: string;
}

/**
 * GULF-03 — non-blocking scope-mismatch advisory (D-07). Rendered with the `--warning`
 * (amber) treatment, NOT `--destructive`: the mismatch is surfaced, the auto-NOC item is
 * recorded server-side, and contract creation still proceeds. Copy is advisory in tone
 * and never asserts a determination (T-79-06-03). Logical properties only (D-13).
 */
export function ScopeMismatchBanner({ mismatch, complianceHref }: ScopeMismatchBannerProps) {
  const t = useTranslations('Contractors.freeZone.scopeMismatch');

  if (!mismatch) return null;

  return (
    <Alert variant="default" className="border-warning/50 bg-warning/10">
      <AlertTriangle aria-hidden="true" className="size-4 text-warning" />
      <AlertTitle>{t('heading')}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{t('body')}</p>
        <Link
          href={complianceHref}
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {t('viewComplianceLink')}
        </Link>
      </AlertDescription>
    </Alert>
  );
}
