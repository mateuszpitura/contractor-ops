/**
 * Portal compliance list — route shell with inlined page content.
 */

import { AtelierEmptyState, ComplianceGapsIllustration } from '@contractor-ops/ui';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Suspense } from 'react';
import { usePortalCompliance } from '../../components/portal/compliance/hooks/use-portal-compliance.js';
import { PortalComplianceList } from '../../components/portal/compliance/portal-compliance-list.js';
import { AnimateIn } from '../../components/shared/animate-in.js';
import { renderEmptyStateAction } from '../../components/shared/atelier-bridges.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { useTranslations } from '../../i18n/useTranslations.js';

function PortalCompliancePageContent() {
  const t = useTranslations('Portal.compliance');
  const { isPending, error, isEmpty, items } = usePortalCompliance();

  return (
    <div className="space-y-6">
      <AnimateIn delay={0}>
        <h1 className="text-[28px] font-semibold leading-[1.2]">{t('listHeading')}</h1>
      </AnimateIn>

      {isPending && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-busy aria-live="polite">
          {[0, 1, 2, 3].map(i => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!isPending && error && (
        <p role="alert" className="text-destructive">
          {t('listError')}
        </p>
      )}

      {!(isPending || error) && isEmpty && (
        <AtelierEmptyState
          variant="subview"
          illustration={ComplianceGapsIllustration}
          heading={t('emptyHeading')}
          body={t('emptyBody')}
          renderAction={renderEmptyStateAction}
        />
      )}

      {!(isPending || error || isEmpty) && (
        <AnimateIn delay={1}>
          <PortalComplianceList items={items} />
        </AnimateIn>
      )}
    </div>
  );
}

export default function PortalCompliancePage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalCompliancePageContent />
    </Suspense>
  );
}
