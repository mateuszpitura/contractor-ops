'use client';

import { AtelierEmptyState, ComplianceGapsIllustration } from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { ContractorEInvoicingSection } from '@/components/contractors/contractor-e-invoicing-section';
import { CountryComplianceSection } from '@/components/contractors/country-compliance-section';
import { DocumentList } from '@/components/documents/document-list';
import { DropZone } from '@/components/documents/drop-zone';
import { renderEmptyStateAction } from '@/components/shared/atelier-bridges';
import { tDynLoose } from '@/i18n/typed-keys';
import { enumKey } from '@/lib/enum-key';
import { useDateFormatter } from '@/lib/format/use-date-formatter';

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
  SATISFIED: 'bg-green-600/10 text-green-600',
  MISSING: 'bg-red-500/10 text-red-500',
  EXPIRED: 'bg-red-500/10 text-red-500',
  PENDING: 'bg-amber-500/10 text-amber-600',
  WAIVED: 'bg-muted text-muted-foreground',
};

function isExpiringSoon(expiresAt: string | Date | null): boolean {
  if (!expiresAt) return false;
  const d = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return d <= thirtyDaysFromNow && d >= new Date();
}

export function TabCompliance({ contractor }: TabComplianceProps) {
  const id = useId();
  const t = useTranslations('ContractorProfile.compliance');
  const { formatDate } = useDateFormatter();

  if (contractor.complianceItems.length === 0) {
    return (
      <div className="space-y-6">
        {/* Country-specific compliance fields (Phase 47) */}
        <CountryComplianceSection contractorId={contractor.id} />
        <ContractorEInvoicingSection contractorId={contractor.id} />

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
      {/* Country-specific compliance fields (Phase 47) */}
      <CountryComplianceSection contractorId={contractor.id} />
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
                  {!!item.documentType && (
                    <span className="text-xs text-muted-foreground">({item.documentType})</span>
                  )}
                </div>
                {!!item.expiresAt && (
                  <div className="mt-0.5 flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">
                      {t('expires')}: {formatDate(item.expiresAt)}
                    </span>
                    {expiringSoon && (
                      <span className="text-xs font-medium text-amber-600">
                        {t('expiringSoon')}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Badge variant="secondary" className={statusBadgeStyles[statusKey] ?? ''}>
                  {tDynLoose(t, 'status', enumKey(statusKey))}
                </Badge>

                {isMissing && (
                  <Button
                    variant="outline"
                    size="sm"
                    // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                    onClick={() => {
                      // Scroll to the upload section at bottom
                      document
                        .getElementById(`${id}-compliance-upload-zone`)
                        ?.scrollIntoView({ behavior: 'smooth' });
                    }}>
                    <Upload className="me-1.5 size-3.5" />
                    {t('upload')}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Required documents section — upload zone */}
      <div id={`${id}-compliance-upload-zone`} className="space-y-4">
        <h3 className="text-base font-medium">{t('uploadCompliance')}</h3>
        <DropZone entityType="CONTRACTOR" entityId={contractor.id} />
      </div>

      {/* Uploaded compliance documents */}
      <DocumentList entityType="CONTRACTOR" entityId={contractor.id} />
    </div>
  );
}
