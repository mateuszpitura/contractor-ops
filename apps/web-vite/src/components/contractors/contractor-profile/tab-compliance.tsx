import { AtelierEmptyState, ComplianceGapsIllustration } from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import { renderEmptyStateAction } from '../../shared/atelier-bridges.js';
import { ContractorEInvoicingSectionContainer } from '../contractor-e-invoicing-section-container.js';
import { CountryComplianceSectionContainer } from '../country-compliance-section-container.js';

type ComplianceItem = {
  id: string;
  name: string;
  documentType: string | null;
  status: string;
  dueDate: string | Date | null;
  expiresAt: string | Date | null;
  requirementTemplateId: string | null;
  contract: { id: string; title: string | null } | null;
};

type TabComplianceProps = {
  contractor: {
    id: string;
    complianceItems: ComplianceItem[];
  };
};

const statusBadgeStyles: Record<string, string> = {
  SATISFIED: 'bg-green-600/10 text-green-800 dark:text-green-400',
  MISSING: 'bg-red-500/10 text-red-500',
  EXPIRED: 'bg-red-500/10 text-red-500',
  PENDING: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
  WAIVED: 'bg-muted text-muted-foreground',
};

function isExpiringSoon(expiresAt: string | Date | null): boolean {
  if (!expiresAt) return false;
  const d = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return d <= thirtyDaysFromNow && d >= new Date();
}

export function TabCompliance({ contractor }: TabComplianceProps) {
  const t = useTranslations('ContractorProfile.compliance');
  const { formatDate } = useDateFormatter();

  if (contractor.complianceItems.length === 0) {
    return (
      <div className="space-y-6">
        <CountryComplianceSectionContainer contractorId={contractor.id} />
        <ContractorEInvoicingSectionContainer contractorId={contractor.id} />
        <AtelierEmptyState
          variant="subview"
          illustration={ComplianceGapsIllustration}
          heading={t('noRequirements')}
          body={t('noRequirementsHint')}
          renderAction={renderEmptyStateAction}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CountryComplianceSectionContainer contractorId={contractor.id} />
      <ContractorEInvoicingSectionContainer contractorId={contractor.id} />
      <h3 className="text-base font-medium">{t('requiredDocuments')}</h3>

      <div className="divide-y rounded-xl border bg-card">
        {contractor.complianceItems.map(item => {
          const isMissing = item.status === 'MISSING';
          const expiringSoon = isExpiringSoon(item.expiresAt);
          const statusKey = item.status as keyof typeof statusBadgeStyles;

          return (
            <div
              key={item.id}
              className={`flex items-center justify-between gap-4 px-4 py-3 ${
                isMissing ? 'bg-red-50 dark:bg-red-950/20' : ''
              }`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.name}</span>
                  {item.documentType ? (
                    <span className="text-xs text-muted-foreground">({item.documentType})</span>
                  ) : null}
                </div>
                {item.expiresAt ? (
                  <div className="mt-0.5 flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">
                      {t('expires')}: {formatDate(item.expiresAt)}
                    </span>
                    {expiringSoon ? (
                      <span className="text-xs font-medium text-amber-600">
                        {t('expiringSoon')}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <Badge variant="secondary" className={statusBadgeStyles[statusKey] ?? ''}>
                {tDynLoose(t, 'status', enumKey(statusKey))}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
