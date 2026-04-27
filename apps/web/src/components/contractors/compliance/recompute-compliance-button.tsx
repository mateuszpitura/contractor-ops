// Phase 71 D-13 — Per-contractor "Recompute compliance" button + dialog launcher.
//
// Pairs with the bulk action on the contractors-list page (uses the same
// RecomputeComplianceDialog with N IDs). Visual style mirrors revalidate-vat-button.tsx.

'use client';

import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RecomputeComplianceDialog } from './recompute-compliance-dialog';

interface RecomputeComplianceButtonProps {
  contractorId: string;
  /** Optional callback after a successful recompute (e.g. to refresh parent list). */
  onSuccess?: () => void;
}

export function RecomputeComplianceButton({
  contractorId,
  onSuccess,
}: RecomputeComplianceButtonProps) {
  const t = useTranslations('Contractors.Compliance.Recompute');
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={t('buttonAriaLabel')}
        data-testid="recompute-compliance-button">
        <RefreshCw className="size-3.5" aria-hidden />
        <span>{t('buttonLabel')}</span>
      </Button>
      <RecomputeComplianceDialog
        open={open}
        onOpenChange={setOpen}
        contractorIds={[contractorId]}
        onSuccess={onSuccess}
      />
    </>
  );
}

interface RecomputeComplianceBulkActionProps {
  contractorIds: string[];
  /** Whether the parent's selection toolbar is currently open. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Bulk variant: renders only the dialog. The parent contractors-list selection
 * toolbar owns the trigger (e.g. a dropdown menu item) and controls `open`.
 */
export function RecomputeComplianceBulkAction({
  contractorIds,
  open,
  onOpenChange,
  onSuccess,
}: RecomputeComplianceBulkActionProps) {
  return (
    <RecomputeComplianceDialog
      open={open}
      onOpenChange={onOpenChange}
      contractorIds={contractorIds}
      onSuccess={onSuccess}
    />
  );
}
