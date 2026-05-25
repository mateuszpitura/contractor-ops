import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

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
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'parsing' | 'results' | 'error'>('upload');
  const [parseError, setParseError] = useState('');
  const [matches, setMatches] = useState<BankStatementMatchResult[]>([]);
  const [selectedMatches, setSelectedMatches] = useState<Set<number>>(new Set());

  const importMutation = useMutation(
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
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.payment.pathFilter());
      },
      onError: err => {
        setParseError(err.message || t('errors.failedToImportStatement'));
        setStep('error');
        toast.error(err.message);
      },
    }),
  );

  const confirmMutation = useMutation(
    trpc.payment.confirmStatementMatches.mutationOptions({
      onSuccess: () => {
        const matchedCount = selectedMatches.size;
        toast.success(t('toast.statementImported', { count: matchedCount }));
        void queryClient.invalidateQueries({ queryKey: [['payment']] });
        resetState();
        options.onClose();
      },
      onError: () => toast.error(t('errors.failedToConfirmMatches')),
    }),
  );

  const resetState = useCallback(() => {
    setStep('upload');
    setParseError('');
    setMatches([]);
    setSelectedMatches(new Set());
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

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
      .filter(m => m.matched && selectedMatches.has(m.transactionIndex))
      .map(m => ({
        itemId: m.itemId as string,
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
