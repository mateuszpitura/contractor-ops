import { useCallback, useRef, useState } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { validateBankStatementFile } from '../../../lib/file-validation.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export interface BankStatementMatchResult {
  transactionIndex: number;
  amountMinor: number;
  iban: string;
  matched: boolean;
  itemId?: string;
  invoiceNumber?: string;
}

export function useBankStatementImport(options: { runId: string; onClose: () => void }) {
  const t = useTranslations('Payments');
  const trpc = useTRPC();
  const toasts = useCommonToasts();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'parsing' | 'results' | 'error'>('upload');
  const [parseError, setParseError] = useState('');
  const [matches, setMatches] = useState<BankStatementMatchResult[]>([]);
  const [selectedMatches, setSelectedMatches] = useState<Set<number>>(new Set());

  const resetState = useCallback(() => {
    setStep('upload');
    setParseError('');
    setMatches([]);
    setSelectedMatches(new Set());
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const importMutation = useResourceMutation(
    trpc.payment.importStatement.mutationOptions({
      onSuccess: data => {
        const results = ((data as Record<string, unknown>)?.matches ??
          []) as BankStatementMatchResult[];
        setMatches(results);
        const matchedIndices = new Set<number>();
        for (const m of results) {
          if (m.matched) matchedIndices.add(m.transactionIndex);
        }
        setSelectedMatches(matchedIndices);
        setStep('results');
      },
      onError: err => {
        setParseError(err.message || t('errors.failedToImportStatement'));
        setStep('error');
      },
    }),
    {
      invalidate: [trpc.payment.pathFilter()],
      successMessage: toasts.done(),
    },
  );

  const confirmMutation = useResourceMutation(
    trpc.payment.confirmStatementMatches.mutationOptions(),
    {
      invalidate: [{ queryKey: [['payment']] }],
      successMessage: t('toast.statementImported', { count: selectedMatches.size }),
      errorMessage: t('errors.failedToConfirmMatches'),
      onClose: () => {
        resetState();
        options.onClose();
      },
    },
  );

  const handleClose = useCallback(() => {
    options.onClose();
    setTimeout(resetState, 200);
  }, [options, resetState]);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const validation = validateBankStatementFile(file);
      if (!validation.valid) {
        const errorKey =
          validation.error === 'INVALID_FORMAT'
            ? 'errors.invalidFileFormat'
            : 'errors.fileTooLarge';
        setParseError(t(errorKey));
        setStep('error');
        return;
      }

      setStep('parsing');
      try {
        const text = await file.text();
        importMutation.mutate({
          runId: options.runId,
          fileContent: text,
          fileName: file.name,
        });
      } catch {
        setParseError(t('errors.failedToReadFile'));
        setStep('error');
      }
    },
    [importMutation, options.runId, t],
  );

  const toggleMatch = useCallback((index: number) => {
    setSelectedMatches(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const matchesToConfirm = matches
      .filter(
        (m): m is BankStatementMatchResult & { itemId: string } =>
          m.matched && selectedMatches.has(m.transactionIndex) && m.itemId != null,
      )
      .map(m => ({
        itemId: m.itemId,
        transactionIndex: m.transactionIndex,
      }));

    confirmMutation.mutate({ runId: options.runId, matches: matchesToConfirm });
  }, [confirmMutation, matches, selectedMatches, options.runId]);

  const handleRetry = useCallback(() => {
    setStep('upload');
    setParseError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  return {
    fileInputRef,
    step,
    parseError,
    matches,
    selectedMatches,
    handleClose,
    handleFileSelect,
    toggleMatch,
    handleConfirm,
    handleRetry,
    isConfirmPending: confirmMutation.isPending,
  } as const;
}
