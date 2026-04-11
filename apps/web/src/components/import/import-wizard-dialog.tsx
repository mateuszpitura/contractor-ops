"use client";

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { StepUpload } from "./step-upload";
import { StepMapping } from "./step-mapping";
import { StepPreview } from "./step-preview";
import { StepDuplicates } from "./step-duplicates";
import { StepConfirm } from "./step-confirm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntityType = "contractor" | "contract";

interface ImportRow {
  rowNumber: number;
  data: Record<string, unknown>;
  status: "valid" | "invalid" | "duplicate";
  errors: Array<{ field: string; message: string }>;
  duplicateOf?: string;
}

interface ParseResult {
  headers: string[];
  sampleRows: Record<string, string>[];
  suggestedMapping: Record<string, string | null>;
  totalRows: number;
}

interface ImportResult {
  validRows: ImportRow[];
  invalidRows: ImportRow[];
  duplicateRows: ImportRow[];
  totalRows: number;
  columnMapping: Record<string, string | null>;
}

interface CommitResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

export type { ImportRow, ParseResult, ImportResult, CommitResult, EntityType };

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({
  steps,
  currentStep,
}: {
  steps: Array<{ label: string; visible: boolean }>;
  currentStep: number;
}) {
  const tAria = useTranslations("Common.aria");
  const visibleSteps = steps.filter((s) => s.visible);
  const visibleIndex = visibleSteps.findIndex(
    (s) => s === steps.filter((_, i) => i <= currentStep).findLast((s2) => s2.visible)
  );

  return (
    <nav aria-label={tAria("wizardProgress")} className="flex items-center justify-center gap-0 py-3">
      {visibleSteps.map((step, index) => {
        const isCompleted = index < visibleIndex;
        const isCurrent = index === visibleIndex;
        const status = isCompleted ? "completed" : isCurrent ? "current" : "upcoming";

        return (
          <div key={step.label} className="flex items-center" aria-current={isCurrent ? "step" : undefined}>
            {index > 0 && (
              <div
                aria-hidden="true"
                className={`mx-1.5 h-px w-6 sm:mx-2 sm:w-8 ${
                  index <= visibleIndex ? "bg-primary" : "bg-border"
                }`}
              />
            )}
            <div className="flex items-center gap-1.5" role="listitem" aria-label={tAria("wizardStep", { step: index + 1, label: step.label, status })}>
              <div
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                  isCompleted
                    ? "bg-primary text-primary-foreground"
                    : isCurrent
                      ? "bg-primary/10 text-primary ring-1 ring-primary"
                      : "bg-muted text-muted-foreground ring-1 ring-border"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-3 w-3" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`hidden whitespace-nowrap text-[13px] sm:inline ${
                  isCurrent
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Import Wizard Dialog
// ---------------------------------------------------------------------------

interface ImportWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEntityType?: EntityType;
}

export function ImportWizardDialog({
  open,
  onOpenChange,
  defaultEntityType = "contractor",
}: ImportWizardDialogProps) {
  const t = useTranslations("Import");
  const tAria = useTranslations("Common.aria");
  const queryClient = useQueryClient();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Data state
  const [entityType, setEntityType] = useState<EntityType>(defaultEntityType);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string | null>>({});
  const [validateResult, setValidateResult] = useState<ImportResult | null>(null);
  const [duplicateActions, setDuplicateActions] = useState<
    Record<string, "skip" | "update" | "create">
  >({});
  const [importResult, setImportResult] = useState<CommitResult | null>(null);

  // Mutations
  const parseMutation = useMutation(
    trpc.import.parse.mutationOptions({
      onSuccess: (data) => {
        const result = data as unknown as ParseResult;
        setParseResult(result);
        setColumnMapping(result.suggestedMapping);
        setCurrentStep(1);
      },
      onError: () => {
        toast.error(t("parseError"));
      },
    })
  );

  const validateMutation = useMutation(
    trpc.import.validate.mutationOptions({
      onSuccess: (data) => {
        const result = data as unknown as ImportResult;
        setValidateResult(result);
        setCurrentStep(2);
      },
      onError: () => {
        toast.error(t("validateError"));
      },
    })
  );

  const commitMutation = useMutation(
    trpc.import.commit.mutationOptions({
      onSuccess: (data) => {
        const result = data as unknown as CommitResult;
        setImportResult(result);
        queryClient.invalidateQueries({
          queryKey: [entityType === "contractor" ? "contractor" : "contract"],
        });
      },
      onError: () => {
        toast.error(t("importError"));
      },
    })
  );

  const isProcessing =
    parseMutation.isPending ||
    validateMutation.isPending ||
    commitMutation.isPending;

  const hasDuplicates = (validateResult?.duplicateRows?.length ?? 0) > 0;

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleFileSelected = useCallback(
    (base64: string, name: string) => {
      setFileBase64(base64);
      setFileName(name);
    },
    []
  );

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
    [fileBase64, parseResult, resetWizard, onOpenChange]
  );

  const handleDiscard = useCallback(() => {
    setShowDiscardDialog(false);
    resetWizard();
    onOpenChange(false);
  }, [resetWizard, onOpenChange]);

  const handleNext = useCallback(() => {
    switch (currentStep) {
      case 0:
        // Upload -> parse file
        if (!fileBase64) return;
        parseMutation.mutate({
          fileBase64,
          entityType,
        } as Parameters<typeof parseMutation.mutate>[0]);
        break;
      case 1:
        // Mapping -> validate
        if (!fileBase64) return;
        validateMutation.mutate({
          fileBase64,
          entityType,
          columnMapping,
        } as Parameters<typeof validateMutation.mutate>[0]);
        break;
      case 2:
        // Preview -> duplicates or confirm
        if (hasDuplicates) {
          setCurrentStep(3);
        } else {
          setCurrentStep(4);
        }
        break;
      case 3:
        // Duplicates -> confirm
        setCurrentStep(4);
        break;
      case 4:
        // Confirm -> commit
        if (!validateResult) return;
        // Remap duplicateActions from rowNumber keys to taxId keys
        // (backend looks up action by taxId, UI stores by rowNumber)
        const taxIdActions: Record<string, "skip" | "update" | "create"> = {};
        for (const row of validateResult.duplicateRows) {
          const action = duplicateActions[String(row.rowNumber)];
          if (action) {
            const taxId = String(
              row.data.taxId ?? row.data.contractorTaxId ?? "",
            );
            if (taxId) taxIdActions[taxId] = action;
          }
        }
        commitMutation.mutate({
          entityType,
          rows: [
            ...(validateResult.validRows).map((r) => r.data),
            ...(validateResult.duplicateRows)
              .filter(
                (r) => duplicateActions[String(r.rowNumber)] !== "skip",
              )
              .map((r) => r.data),
          ],
          duplicateActions: taxIdActions,
        });
        break;
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
  ]);

  const handleBack = useCallback(() => {
    if (currentStep === 4 && !hasDuplicates) {
      setCurrentStep(2);
    } else if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep, hasDuplicates]);

  // Check if required mappings are complete for next button
  const requiredContractorFields = ["legalName", "taxId", "email"];
  const requiredContractFields = ["title", "type", "startDate", "contractorTaxId"];
  const requiredFields =
    entityType === "contractor" ? requiredContractorFields : requiredContractFields;

  const mappedTargets = Object.values(columnMapping).filter(Boolean);
  const allRequiredMapped = requiredFields.every((f) => mappedTargets.includes(f));

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

  // Step configuration
  const stepLabels = [
    { label: t("steps.upload"), visible: true },
    { label: t("steps.mapping"), visible: true },
    { label: t("steps.preview"), visible: true },
    { label: t("steps.duplicates"), visible: hasDuplicates },
    { label: t("steps.confirm"), visible: true },
  ];

  const getNextLabel = () => {
    if (currentStep === 4) return t("actions.import");
    return t("actions.next");
  };

  // Compute confirm step counts
  const confirmCounts = {
    newRecords: validateResult?.validRows?.length ?? 0,
    updates: Object.values(duplicateActions).filter((a) => a === "update").length,
    skippedDuplicates:
      Object.values(duplicateActions).filter((a) => a === "skip").length +
      (validateResult?.duplicateRows?.length ?? 0) -
      Object.keys(duplicateActions).length,
    skippedErrors: validateResult?.invalidRows?.length ?? 0,
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="sm:max-w-[720px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <StepIndicator steps={stepLabels} currentStep={currentStep} />

          {/* Step content */}
          <div className="min-h-[360px]">
            {currentStep === 0 && (
              <StepUpload
                entityType={entityType}
                onEntityTypeChange={setEntityType}
                onFileSelected={handleFileSelected}
                fileName={fileName}
                onFileRemoved={() => {
                  setFileBase64(null);
                  setFileName(null);
                }}
              />
            )}
            {currentStep === 1 && parseResult && (
              <StepMapping
                headers={parseResult.headers}
                sampleRows={parseResult.sampleRows}
                suggestedMapping={parseResult.suggestedMapping}
                entityType={entityType}
                columnMapping={columnMapping}
                onMappingChange={setColumnMapping}
              />
            )}
            {currentStep === 2 && validateResult && (
              <StepPreview
                validRows={validateResult.validRows}
                invalidRows={validateResult.invalidRows}
                totalRows={validateResult.totalRows}
              />
            )}
            {currentStep === 3 && validateResult && (
              <StepDuplicates
                duplicateRows={validateResult.duplicateRows}
                duplicateActions={duplicateActions}
                onActionsChange={setDuplicateActions}
              />
            )}
            {currentStep === 4 && (
              <StepConfirm
                entityType={entityType}
                counts={confirmCounts}
                onImport={async () => handleNext()}
                importResult={importResult}
                isImporting={commitMutation.isPending}
              />
            )}
          </div>

          {/* Footer */}
          {!importResult && (
            <div className="flex items-center justify-between border-t pt-4 mt-2">
              <div>
                {currentStep > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={isProcessing}
                  >
                    {t("actions.back")}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleClose()}
                  >
                    {fileBase64 ? t("actions.discard") : t("actions.close")}
                  </Button>
                )}
              </div>
              {currentStep < 4 && (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceed || isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                      {t("actions.processing")}
                    </>
                  ) : (
                    getNextLabel()
                  )}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Discard confirmation */}
      <AlertDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("discard.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("discard.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("discard.keep")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscard}
              variant="destructive"
            >
              {t("discard.discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
