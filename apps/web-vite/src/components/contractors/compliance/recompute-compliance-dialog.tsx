// Phase 71 D-13..D-16 — Recompute compliance confirm dialog.
// Step 11 codemod port from apps/web/src/components/contractors/compliance/recompute-compliance-dialog.tsx.

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useRecomputeCompliance } from '../hooks/use-recompute-compliance.js';

type RecomputeReason = 'policy_version_bump' | 'classification_outcome_change' | 'admin_correction';

export interface RecomputeComplianceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractorIds: string[];
  onSuccess?: () => void;
}

type RecomputeComplianceDialogViewProps = RecomputeComplianceDialogProps &
  Pick<ReturnType<typeof useRecomputeCompliance>, 'mutation' | 'isPending'>;

export function RecomputeComplianceDialogView({
  open,
  onOpenChange,
  contractorIds,
  onSuccess,
  mutation,
  isPending,
}: RecomputeComplianceDialogViewProps) {
  const t = useTranslations('Contractors.Compliance.Recompute');
  const [reason, setReason] = useState<RecomputeReason | null>(null);

  const handleConfirm = useCallback(() => {
    if (!reason) return;
    mutation.mutate(
      { contractorIds, reason },
      {
        onSuccess: () => {
          setReason(null);
          onOpenChange(false);
          onSuccess?.();
        },
      },
    );
  }, [reason, mutation, contractorIds, onOpenChange, onSuccess]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setReason(null);
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const handleReasonChange = useCallback(
    (value: string | null) => setReason(value ? (value as RecomputeReason) : null),
    [],
  );

  const isBulk = contractorIds.length > 1;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isBulk ? t('bulkTitle', { count: contractorIds.length }) : t('title')}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('description')}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <label htmlFor="recompute-reason" className="text-sm font-medium">
            {t('reasonLabel')}
          </label>
          <Select value={reason ?? ''} onValueChange={handleReasonChange}>
            <SelectTrigger id="recompute-reason" aria-label={t('reasonLabel')}>
              <SelectValue placeholder={t('reasonPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="policy_version_bump">{t('reason.policyVersionBump')}</SelectItem>
              <SelectItem value="classification_outcome_change">
                {t('reason.classificationOutcomeChange')}
              </SelectItem>
              <SelectItem value="admin_correction">{t('reason.adminCorrection')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!reason || isPending}
            data-testid="recompute-compliance-confirm">
            {isPending ? t('confirming') : t('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
