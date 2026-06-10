import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { usePermissions } from '../../../hooks/use-permissions.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { OverrideComplianceItemDialogContainer } from './override-compliance-item-dialog.js';

export interface OverrideComplianceItemButtonProps {
  itemId: string;
  severity: string | null;
  status: string;
}

/**
 * Phase 73 D-12 — the SINGLE override-launcher button, mounted on the Compliance
 * tab (inline per row) AND the dashboard tables (via renderRowActions). Renders
 * only when the caller has compliance:override AND the item is a BLOCKING
 * MISSING/EXPIRED item; otherwise null. The server is the source of truth.
 */
export function OverrideComplianceItemButton({
  itemId,
  severity,
  status,
}: OverrideComplianceItemButtonProps) {
  const t = useTranslations('Compliance.override');
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);

  const eligible =
    can('compliance', ['override']) &&
    severity === 'BLOCKING' &&
    (status === 'MISSING' || status === 'EXPIRED');

  if (!eligible) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={t('buttonAriaLabel')}>
        <ShieldCheck className="size-4" aria-hidden />
        {t('buttonLabel')}
      </Button>
      <OverrideComplianceItemDialogContainer itemId={itemId} open={open} onOpenChange={setOpen} />
    </>
  );
}
