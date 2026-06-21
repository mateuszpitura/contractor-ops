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
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogSection,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Check, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useImportWizardDialog } from './hooks/use-import-wizard.js';
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

function StepIndicatorItem({
  step,
  index,
  visibleIndex,
  tAria,
}: {
  step: { label: string; visible: boolean };
  index: number;
  visibleIndex: number;
  tAria: ReturnType<typeof useTranslations>;
}) {
  const isCompleted = index < visibleIndex;
  const isCurrent = index === visibleIndex;
  const status = isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming';

  return (
    <div className="flex items-center" aria-current={isCurrent ? 'step' : undefined}>
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
}

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
      {visibleSteps.map((step, index) => (
        <StepIndicatorItem
          key={step.label}
          step={step}
          index={index}
          visibleIndex={visibleIndex}
          tAria={tAria}
        />
      ))}
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

type HookReturn = ReturnType<typeof useImportWizardDialog>;

export interface ImportWizardDialogViewProps
  extends Pick<ImportWizardDialogProps, 'open'>,
    Pick<
      HookReturn,
      | 't'
      | 'currentStep'
      | 'showDiscardDialog'
      | 'setShowDiscardDialog'
      | 'fileBase64'
      | 'importResult'
      | 'isProcessing'
      | 'handleClose'
      | 'handleDiscard'
      | 'handleNext'
      | 'handleBack'
      | 'canProceed'
      | 'stepLabels'
      | 'getNextLabel'
    > {
  stepBody: ReactNode;
}

export function ImportWizardDialogView({
  open,
  t,
  currentStep,
  showDiscardDialog,
  setShowDiscardDialog,
  fileBase64,
  importResult,
  isProcessing,
  handleClose,
  handleDiscard,
  handleNext,
  handleBack,
  canProceed,
  stepLabels,
  getNextLabel,
  stepBody,
}: ImportWizardDialogViewProps) {
  const handleDialogOpenChange = useCallback(
    (o: boolean) => {
      if (!o) handleClose();
    },
    [handleClose],
  );
  const handleCloseClick = useCallback(() => handleClose(), [handleClose]);
  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-[720px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <DialogSection>
            <StepIndicator steps={stepLabels} currentStep={currentStep} />
          </DialogSection>

          <DialogBody className="min-h-[360px]">{stepBody}</DialogBody>

          {!importResult && (
            <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
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
                  <Button type="button" variant="ghost" onClick={handleCloseClick}>
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
            </DialogFooter>
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

export function ImportWizardDialog(props: ImportWizardDialogProps) {
  const wizard = useImportWizardDialog(props);

  const handleFileRemoved = useCallback(() => {
    wizard.setFileBase64(null);
    wizard.setFileName(null);
  }, [wizard.setFileBase64, wizard.setFileName]);

  const handleImport = useCallback(async () => wizard.handleNext(), [wizard.handleNext]);

  let stepBody: ReactNode = null;
  switch (wizard.currentStep) {
    case 0:
      stepBody = (
        <StepUpload
          entityType={wizard.entityType}
          onEntityTypeChange={wizard.setEntityType}
          onFileSelected={wizard.handleFileSelected}
          fileName={wizard.fileName}
          onFileRemoved={handleFileRemoved}
        />
      );
      break;
    case 1:
      if (wizard.parseResult) {
        stepBody = (
          <StepMapping
            headers={wizard.parseResult.headers}
            sampleRows={wizard.parseResult.sampleRows}
            suggestedMapping={wizard.parseResult.suggestedMapping}
            entityType={wizard.entityType}
            columnMapping={wizard.columnMapping}
            onMappingChange={wizard.setColumnMapping}
          />
        );
      }
      break;
    case 2:
      if (wizard.validateResult) {
        stepBody = (
          <StepPreview
            validRows={wizard.validateResult.validRows}
            invalidRows={wizard.validateResult.invalidRows}
            totalRows={wizard.validateResult.totalRows}
          />
        );
      }
      break;
    case 3:
      if (wizard.validateResult) {
        stepBody = (
          <StepDuplicates
            duplicateRows={wizard.validateResult.duplicateRows}
            duplicateActions={wizard.duplicateActions}
            onActionsChange={wizard.setDuplicateActions}
          />
        );
      }
      break;
    case 4:
      stepBody = (
        <StepConfirm
          entityType={wizard.entityType}
          counts={wizard.confirmCounts}
          onImport={handleImport}
          importResult={wizard.importResult}
          isImporting={wizard.commitMutation.isPending}
        />
      );
      break;
  }

  return (
    <ImportWizardDialogView
      open={props.open}
      t={wizard.t}
      currentStep={wizard.currentStep}
      showDiscardDialog={wizard.showDiscardDialog}
      setShowDiscardDialog={wizard.setShowDiscardDialog}
      fileBase64={wizard.fileBase64}
      importResult={wizard.importResult}
      isProcessing={wizard.isProcessing}
      handleClose={wizard.handleClose}
      handleDiscard={wizard.handleDiscard}
      handleNext={wizard.handleNext}
      handleBack={wizard.handleBack}
      canProceed={wizard.canProceed}
      stepLabels={wizard.stepLabels}
      getNextLabel={wizard.getNextLabel}
      stepBody={stepBody}
    />
  );
}
