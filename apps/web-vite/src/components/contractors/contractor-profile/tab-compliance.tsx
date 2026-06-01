import { AtelierEmptyState, ComplianceGapsIllustration } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { FileSearch, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { usePermissions } from '../../../hooks/use-permissions.js';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import { ComplianceStatusBadge } from '../../compliance/compliance-status-badge.js';
import { renderEmptyStateAction } from '../../shared/atelier-bridges.js';
import { ComplianceItemHistory } from '../compliance/compliance-item-history.js';
import { OverrideComplianceItemButton } from '../compliance/override-compliance-item-button.js';
import { UploadReviewDialogContainer } from '../compliance/upload-review-dialog-container.js';
import { ContractorEInvoicingSectionContainer } from '../contractor-e-invoicing-section-container.js';
import { CountryComplianceSectionContainer } from '../country-compliance-section-container.js';

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type ComplianceItem = {
  id: string;
  name: string;
  documentType: string | null;
  status: string;
  severity: string | null;
  dueDate: string | Date | null;
  expiresAt: string | Date | null;
  requirementTemplateId: string | null;
  waivedReasonCategory: string | null;
  /** Set by submitUploadReplacement when a PENDING_REVIEW document exists. */
  pendingReviewDocumentId?: string | null;
  contract: { id: string; title: string | null } | null;
};

type TabComplianceProps = {
  contractor: {
    id: string;
    complianceItems: ComplianceItem[];
  };
};

function isExpiringSoon(expiresAt: string | Date | null): boolean {
  if (!expiresAt) return false;
  const d = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return d <= thirtyDaysFromNow && d >= new Date();
}

function ReviewUploadButton({
  itemId,
  documentId,
  defaultExpiresAt,
}: {
  itemId: string;
  documentId: string;
  defaultExpiresAt: string;
}) {
  const t = useTranslations('Compliance.uploadReview');
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);

  if (!can('compliance', ['override'])) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={t('reviewButtonAriaLabel')}>
        <FileSearch className="size-4" aria-hidden />
        {t('reviewButtonLabel')}
      </Button>
      <UploadReviewDialogContainer
        itemId={itemId}
        documentId={documentId}
        defaultExpiresAt={defaultExpiresAt}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

export function TabCompliance({ contractor }: TabComplianceProps) {
  const t = useTranslations('ContractorProfile.compliance');
  const tOverride = useTranslations('Compliance.override');
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
          const statusKey = item.status;
          const hasPendingReview = item.pendingReviewDocumentId != null;

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
                <div className="mt-1">
                  <ComplianceItemHistory itemId={item.id} />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {hasPendingReview ? (
                  <ReviewUploadButton
                    itemId={item.id}
                    documentId={item.pendingReviewDocumentId as string}
                    defaultExpiresAt={item.expiresAt ? toIsoDate(new Date(item.expiresAt)) : ''}
                  />
                ) : (
                  <OverrideComplianceItemButton
                    itemId={item.id}
                    severity={item.severity}
                    status={item.status}
                  />
                )}
                {item.status === 'WAIVED' ? (
                  <Tooltip>
                    <TooltipTrigger className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                      <ShieldCheck className="mr-1 size-3" aria-hidden />
                      {tDynLoose(t, 'status', enumKey(statusKey))}
                    </TooltipTrigger>
                    <TooltipContent>
                      {item.waivedReasonCategory
                        ? t('waivedTooltip', {
                            category: tDynLoose(tOverride, 'category', item.waivedReasonCategory),
                          })
                        : t('waivedTooltipGeneric')}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <ComplianceStatusBadge status={item.status} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
