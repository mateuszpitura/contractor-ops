// Phase 71 D-13..D-16 — Recompute compliance confirm dialog.
//
// Shared between the per-contractor button (single ID) and the contractors-
// list bulk action (N IDs). Calls trpc.classification.recreateComplianceAssessment
// with a closed-enum reason; shows success/partial/error toasts based on the
// per-contractor result counts.

'use client';

import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/trpc/init';

type RecomputeReason = 'policy_version_bump' | 'classification_outcome_change' | 'admin_correction';

interface RecomputeComplianceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractorIds: string[];
  /** Optional callback invoked once after a successful (non-error) mutation. */
  onSuccess?: () => void;
}

interface MutationResultEntry {
  contractorId: string;
  noop?: boolean;
  reason?: string;
  policyRuleSetVersionBefore?: string | null;
  waivedCount?: number;
  insertedCount?: number;
  carriedForwardCount?: number;
  error?: string;
}

interface MutationResultPayload {
  results: MutationResultEntry[];
}

export function RecomputeComplianceDialog({
  open,
  onOpenChange,
  contractorIds,
  onSuccess,
}: RecomputeComplianceDialogProps) {
  const t = useTranslations('Contractors.Compliance.Recompute');
  const [reason, setReason] = useState<RecomputeReason | null>(null);

  const mutation = useMutation(
    trpc.classification.recreateComplianceAssessment.mutationOptions({
      onSuccess: (data: MutationResultPayload) => {
        const updated = data.results
          .filter(r => r.noop !== true && !r.error)
          .reduce((acc, r) => acc + (r.waivedCount ?? 0) + (r.insertedCount ?? 0), 0);
        const skipped = data.results.filter(r => r.noop === true).length;
        const errored = data.results.filter(r => r.error).length;

        if (errored > 0) {
          toast.warning(t('toast.partial', { updated, skipped, errored }));
        } else if (skipped > 0) {
          toast.success(t('toast.successWithSkipped', { updated, skipped }));
        } else {
          toast.success(t('toast.success', { updated }));
        }
        setReason(null);
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (err: { message?: string }) => {
        toast.error(err.message || t('toast.error'));
      },
    }),
  );

  const handleConfirm = () => {
    if (!reason) return;
    mutation.mutate({ contractorIds, reason });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setReason(null);
    onOpenChange(next);
  };

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
          <Select value={reason ?? ''} onValueChange={value => setReason(value as RecomputeReason)}>
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
            disabled={!reason || mutation.isPending}
            data-testid="recompute-compliance-confirm">
            {mutation.isPending ? t('confirming') : t('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
