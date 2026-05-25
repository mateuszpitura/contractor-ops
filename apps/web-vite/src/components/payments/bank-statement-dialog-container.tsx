import { useCallback } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { BankStatementDialog } from './bank-statement-dialog.js';
import { useBankStatementImport } from './hooks/use-bank-statement-import.js';

interface BankStatementDialogContainerProps {
  runId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BankStatementDialogContainer({
  runId,
  open,
  onOpenChange,
}: BankStatementDialogContainerProps) {
  const t = useTranslations('Payments');

  const handleCloseFromHook = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const importFlow = useBankStatementImport({ runId, onClose: handleCloseFromHook });

  return (
    <BankStatementDialog open={open} onOpenChange={onOpenChange} t={t} importFlow={importFlow} />
  );
}
