import { AtelierEmptyState, ComplianceGapsIllustration } from '@contractor-ops/ui';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { renderEmptyStateAction } from '../../shared/atelier-bridges.js';
import { usePortalCompliance } from './hooks/use-portal-compliance.js';
import { PortalComplianceList } from './portal-compliance-list.js';

/** Decisive container for the portal compliance self-service list (COMPL-04). */
export function PortalComplianceContainer() {
  const t = useTranslations('Portal.compliance');
  const { isPending, error, isEmpty, items } = usePortalCompliance();

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold leading-[1.2]">{t('listHeading')}</h1>

      {isPending && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-busy aria-live="polite">
          {[0, 1, 2, 3].map(i => (
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

      {!(isPending || error || isEmpty) && <PortalComplianceList items={items} />}
    </div>
  );
}
