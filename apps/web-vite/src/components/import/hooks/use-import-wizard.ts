import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type {
  CommitResult,
  EntityType,
  ImportResult,
  ParseResult,
} from '../import-wizard-dialog.js';

export function useImportWizardMutations(
  entityType: EntityType,
  onParseSuccess: (result: ParseResult) => void,
  onValidateSuccess: (result: ImportResult) => void,
  onCommitSuccess: (result: CommitResult) => void,
) {
  const trpc = useTRPC();
  const t = useTranslations('Import');
  const queryClient = useQueryClient();
  const toasts = useCommonToasts();

  const parseMutation = useMutation({
    ...trpc.import.parse.mutationOptions(),
    onSuccess: data => {
      const result = data as unknown as ParseResult;
      onParseSuccess(result);
      toast.success(toasts.done());
      queryClient.invalidateQueries(trpc.import.pathFilter());
    },
    onError: () => {
      toast.error(t('parseError'));
    },
  });

  const validateMutation = useMutation({
    ...trpc.import.validate.mutationOptions(),
    onSuccess: data => {
      const result = data as unknown as ImportResult;
      onValidateSuccess(result);
      toast.success(toasts.done());
      queryClient.invalidateQueries(trpc.import.pathFilter());
    },
    onError: () => {
      toast.error(t('validateError'));
    },
  });

  const commitMutation = useMutation({
    ...trpc.import.commit.mutationOptions(),
    onSuccess: data => {
      const result = data as unknown as CommitResult;
      onCommitSuccess(result);
      queryClient.invalidateQueries({
        queryKey: [entityType === 'contractor' ? 'contractor' : 'contract'],
      });
      toast.success(toasts.done());
    },
    onError: () => {
      toast.error(t('importError'));
    },
  });

  const isProcessing =
    parseMutation.isPending || validateMutation.isPending || commitMutation.isPending;

  return {
    parseMutation,
    validateMutation,
    commitMutation,
    isProcessing,
  } as const;
}

export function useImportWizardReset() {
  return useCallback(
    (
      resetters: {
        setCurrentStep: (n: number) => void;
        setFileBase64: (v: string | null) => void;
        setFileName: (v: string | null) => void;
        setParseResult: (v: ParseResult | null) => void;
        setColumnMapping: (v: Record<string, string | null>) => void;
        setValidateResult: (v: ImportResult | null) => void;
        setDuplicateActions: (v: Record<string, 'skip' | 'update' | 'create'>) => void;
        setImportResult: (v: CommitResult | null) => void;
      },
      _entityType: EntityType,
    ) => {
      resetters.setCurrentStep(0);
      resetters.setFileBase64(null);
      resetters.setFileName(null);
      resetters.setParseResult(null);
      resetters.setColumnMapping({});
      resetters.setValidateResult(null);
      resetters.setDuplicateActions({});
      resetters.setImportResult(null);
    },
    [],
  );
}

export interface UseImportWizardDialogParams {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEntityType?: EntityType;
}

export function useImportWizardDialog({
  onOpenChange,
  defaultEntityType = 'contractor',
}: UseImportWizardDialogParams) {
  const t = useTranslations('Import');

  const [currentStep, setCurrentStep] = useState(0);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [entityType, setEntityType] = useState<EntityType>(defaultEntityType);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string | null>>({});
  const [validateResult, setValidateResult] = useState<ImportResult | null>(null);
  const [duplicateActions, setDuplicateActions] = useState<
    Record<string, 'skip' | 'update' | 'create'>
  >({});
  const [importResult, setImportResult] = useState<CommitResult | null>(null);

  const { parseMutation, validateMutation, commitMutation, isProcessing } =
    useImportWizardMutations(
      entityType,
      result => {
        setParseResult(result);
        setColumnMapping(result.suggestedMapping);
        setCurrentStep(1);
      },
      result => {
        setValidateResult(result);
        setCurrentStep(2);
      },
      result => {
        setImportResult(result);
      },
    );

  const hasDuplicates = (validateResult?.duplicateRows?.length ?? 0) > 0;

  const handleFileSelected = useCallback((base64: string, name: string) => {
    setFileBase64(base64);
    setFileName(name);
  }, []);

  const resetWizard = useCallback(() => {
    setCurrentStep(0);
    setFileBase64(null);
    setFileName(null);
    setParseResult(null);
    setColumnMapping({});
    setValidateResult(null);
    setDuplicateActions({});
    setImportResult(null);
    parseMutation.reset();
    validateMutation.reset();
    commitMutation.reset();
  }, [parseMutation, validateMutation, commitMutation]);

  const handleClose = useCallback(
    (force = false) => {
      if (!force && (fileBase64 || parseResult)) {
        setShowDiscardDialog(true);
        return;
      }
      resetWizard();
      onOpenChange(false);
    },
    [fileBase64, parseResult, resetWizard, onOpenChange],
  );

  const handleDiscard = useCallback(() => {
    setShowDiscardDialog(false);
    resetWizard();
    onOpenChange(false);
  }, [resetWizard, onOpenChange]);

  const handleNext = useCallback(() => {
    switch (currentStep) {
      case 0:
        if (!fileBase64) return;
        parseMutation.mutate({
          fileBase64,
          entityType,
        } as Parameters<typeof parseMutation.mutate>[0]);
        break;
      case 1:
        if (!fileBase64) return;
        validateMutation.mutate({
          fileBase64,
          entityType,
          columnMapping,
        } as Parameters<typeof validateMutation.mutate>[0]);
        break;
      case 2:
        if (hasDuplicates) {
          setCurrentStep(3);
        } else {
          setCurrentStep(4);
        }
        break;
      case 3:
        setCurrentStep(4);
        break;
      case 4: {
        if (!validateResult) return;
        const taxIdActions: Record<string, 'skip' | 'update' | 'create'> = {};
        for (const row of validateResult.duplicateRows) {
          const action = duplicateActions[String(row.rowNumber)];
          if (action) {
            const taxId = String(row.data.taxId ?? row.data.contractorTaxId ?? '');
            if (taxId) taxIdActions[taxId] = action;
          }
        }
        commitMutation.mutate({
          entityType,
          rows: [
            ...validateResult.validRows.map(r => r.data),
            ...validateResult.duplicateRows
              .filter(r => duplicateActions[String(r.rowNumber)] !== 'skip')
              .map(r => r.data),
          ],
          duplicateActions: taxIdActions,
        });
        break;
      }
    }
  }, [
    currentStep,
    fileBase64,
    entityType,
    columnMapping,
    duplicateActions,
    hasDuplicates,
    parseMutation,
    validateMutation,
    commitMutation,
    validateResult,
  ]);

  const handleBack = useCallback(() => {
    if (currentStep === 4 && !hasDuplicates) {
      setCurrentStep(2);
    } else if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  }, [currentStep, hasDuplicates]);

  const requiredContractorFields = ['legalName', 'taxId', 'email'];
  const requiredContractFields = ['title', 'type', 'startDate', 'contractorTaxId'];
  const requiredFields =
    entityType === 'contractor' ? requiredContractorFields : requiredContractFields;

  const mappedTargets = Object.values(columnMapping).filter(Boolean);
  const allRequiredMapped = requiredFields.every(f => mappedTargets.includes(f));

  const canProceed = (() => {
    switch (currentStep) {
      case 0:
        return !!fileBase64;
      case 1:
        return allRequiredMapped;
      case 2:
        return true;
      case 3:
        return true;
      case 4:
        return !importResult;
      default:
        return false;
    }
  })();

  const stepLabels = [
    { label: t('steps.upload'), visible: true },
    { label: t('steps.mapping'), visible: true },
    { label: t('steps.preview'), visible: true },
    { label: t('steps.duplicates'), visible: hasDuplicates },
    { label: t('steps.confirm'), visible: true },
  ];

  const getNextLabel = () => {
    if (currentStep === 4) return t('actions.import');
    return t('actions.next');
  };

  const confirmCounts = {
    newRecords: validateResult?.validRows?.length ?? 0,
    updates: Object.values(duplicateActions).filter(a => a === 'update').length,
    skippedDuplicates:
      Object.values(duplicateActions).filter(a => a === 'skip').length +
      (validateResult?.duplicateRows?.length ?? 0) -
      Object.keys(duplicateActions).length,
    skippedErrors: validateResult?.invalidRows?.length ?? 0,
  };

  return {
    t,
    currentStep,
    showDiscardDialog,
    setShowDiscardDialog,
    entityType,
    setEntityType,
    fileBase64,
    fileName,
    parseResult,
    columnMapping,
    setColumnMapping,
    validateResult,
    duplicateActions,
    setDuplicateActions,
    importResult,
    isProcessing,
    commitMutation,
    hasDuplicates,
    handleFileSelected,
    handleClose,
    handleDiscard,
    handleNext,
    handleBack,
    canProceed,
    stepLabels,
    getNextLabel,
    confirmCounts,
    setFileBase64,
    setFileName,
  } as const;
}
