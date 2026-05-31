import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { ShieldAlert } from 'lucide-react';

import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { usePortalCompliance } from './compliance/hooks/use-portal-compliance.js';

/**
 * Phase 73 COMPL-04 / D-09 — portal-home attention banner. Surfaces when the
 * contractor has any MISSING/EXPIRED item or any item expiring within 30 days,
 * linking to the self-service list. Surface only — no cron (Phase 72 owns that).
 */
export function PortalHomeComplianceBanner() {
  const t = useTranslations('Portal.compliance');
  const { isPending, error, attentionItems } = usePortalCompliance();

  if (isPending || error || attentionItems.length === 0) {
    return null;
  }

  return (
    <Alert>
      <ShieldAlert className="size-4" aria-hidden />
      <AlertTitle>{t('banner.title')}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-2">
        <span>{t('banner.body', { count: attentionItems.length })}</span>
        <Link href="/portal/compliance" className="font-medium text-primary hover:underline">
          {t('banner.cta')}
        </Link>
      </AlertDescription>
    </Alert>
  );
}
