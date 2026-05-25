import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Check, Loader2 } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import type { useImportWizardDialog } from './hooks/use-import-wizard.js';
import { StepConfirm } from './step-confirm.js';
import { StepDuplicates } from './step-duplicates.js';
import { StepMapping } from './step-mapping.js';
import { StepPreview } from './step-preview.js';
import { StepUpload } from './step-upload.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntityType = 'contractor' | 'contract';

interface ImportRow {
  rowNumber: number;
  data: Record<string, unknown>;
  status: 'valid' | 'invalid' | 'duplicate';
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

export type { CommitResult, EntityType, ImportResult, ImportRow, ParseResult };

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
  const tAria = useTranslations('Common.aria');
  const visibleSteps = steps.filter(s => s.visible);
  const visibleIndex = visibleSteps.findIndex(
    s => s === steps.filter((_, i) => i <= currentStep).findLast(s2 => s2.visible),
  );

  return (
    <nav
      aria-label={tAria('wizardProgress')}
      className="flex items-center justify-center gap-0 py-3">
      {visibleSteps.map((step, index) => {
        const isCompleted = index < visibleIndex;
        const isCurrent = index === visibleIndex;
        const status = isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming';

        return (
          <div
            key={step.label}
            className="flex items-center"
            aria-current={isCurrent ? 'step' : undefined}>
            {index > 0 && (
              <div
                aria-hidden="true"
                className={`mx-1.5 h-px w-6 sm:mx-2 sm:w-8 ${
                  index <= visibleIndex ? 'bg-primary' : 'bg-border'
                }`}
              />
            )}
            <span
              className="flex items-center gap-1.5"
              role="img"
              aria-label={tAria('wizardStep', { step: index + 1, label: step.label, status })}>
              <div
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                  isCompleted
                    ? 'bg-primary text-primary-foreground'
                    : isCurrent
                      ? 'bg-primary/10 text-primary ring-1 ring-primary'
                      : 'bg-muted text-muted-foreground ring-1 ring-border'
                }`}>
                {isCompleted ? <Check className="h-3 w-3" /> : index + 1}
              </div>
              <span
                className={`hidden whitespace-nowrap text-[13px] sm:inline ${
                  isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'
                }`}>
                {step.label}
              </span>
            </span>
          </div>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Import Wizard Dialog
// ---------------------------------------------------------------------------

export interface ImportWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEntityType?: EntityType;
}

export type ImportWizardDialogViewProps = ImportWizardDialogProps &
  ReturnType<typeof useImportWizardDialog>;

export function ImportWizardDialogView({
  open,
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
}: ImportWizardDialogViewProps) {
  return (
    <>
      {/* biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler */}
      <Dialog open={open} onOpenChange={o => !o && handleClose()}>
        <DialogContent className="sm:max-w-[720px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
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
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
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
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
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
                    disabled={isProcessing}>
                    {t('actions.back')}
                  </Button>
                ) : (
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  <Button type="button" variant="ghost" onClick={() => handleClose()}>
                    {fileBase64 ? t('actions.discard') : t('actions.close')}
                  </Button>
                )}
              </div>
              {currentStep < 4 && (
                <Button type="button" onClick={handleNext} disabled={!canProceed || isProcessing}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                      {t('actions.processing')}
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
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('discard.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('discard.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('discard.keep')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscard} variant="destructive">
              {t('discard.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
