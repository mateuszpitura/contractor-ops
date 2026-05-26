// Phase 71 D-13 — Per-contractor "Recompute compliance" button + dialog launcher.
// Step 11 codemod port from apps/web/src/components/contractors/compliance/recompute-compliance-button.tsx.

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { RecomputeComplianceDialogContainer } from './recompute-compliance-dialog-container.js';

interface RecomputeComplianceButtonProps {
  contractorId: string;
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
      <RecomputeComplianceDialogContainer
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function RecomputeComplianceBulkAction({
  contractorIds,
  open,
  onOpenChange,
  onSuccess,
}: RecomputeComplianceBulkActionProps) {
  return (
    <RecomputeComplianceDialogContainer
      open={open}
      onOpenChange={onOpenChange}
      contractorIds={contractorIds}
      onSuccess={onSuccess}
    />
  );
}
