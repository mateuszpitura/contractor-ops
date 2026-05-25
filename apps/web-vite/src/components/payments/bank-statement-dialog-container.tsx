import { useCallback } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import {
  BankStatementDialogShell,
  BankStatementErrorStep,
  BankStatementParsingStep,
  BankStatementResultsStep,
  BankStatementUploadStep,
} from './bank-statement-dialog.js';
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

  const matchedCount = importFlow.matches.filter(m => m.matched).length;

  return (
    <BankStatementDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseAttempt={importFlow.handleClose}
      t={t}>
      {importFlow.step === 'upload' && (
        <BankStatementUploadStep
          t={t}
          fileInputRef={importFlow.fileInputRef}
          onFileSelect={importFlow.handleFileSelect}
        />
      )}

      {importFlow.step === 'parsing' && <BankStatementParsingStep t={t} />}

      {importFlow.step === 'results' && (
        <BankStatementResultsStep
          t={t}
          matches={importFlow.matches}
          selectedMatches={importFlow.selectedMatches}
          matchedCount={matchedCount}
          totalCount={importFlow.matches.length}
          selectedCount={importFlow.selectedMatches.size}
          onToggleMatch={importFlow.toggleMatch}
          onCancel={importFlow.handleClose}
          onConfirm={importFlow.handleConfirm}
          isConfirmPending={importFlow.isConfirmPending}
        />
      )}

      {importFlow.step === 'error' && (
        <BankStatementErrorStep
          t={t}
          parseError={importFlow.parseError}
          onRetry={importFlow.handleRetry}
        />
      )}
    </BankStatementDialogShell>
  );
}
