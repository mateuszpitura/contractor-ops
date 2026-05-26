import { useImportWizardDialog } from './hooks/use-import-wizard.js';
import type { ImportWizardDialogProps } from './import-wizard-dialog.js';
import { ImportWizardDialogView } from './import-wizard-dialog.js';
import { StepConfirm } from './step-confirm.js';
import { StepDuplicates } from './step-duplicates.js';
import { StepMapping } from './step-mapping.js';
import { StepPreview } from './step-preview.js';
import { StepUpload } from './step-upload.js';

export function ImportWizardDialogContainer(props: ImportWizardDialogProps) {
  const wizard = useImportWizardDialog(props);

  let stepBody: React.ReactNode = null;
  switch (wizard.currentStep) {
    case 0:
      stepBody = (
        <StepUpload
          entityType={wizard.entityType}
          onEntityTypeChange={wizard.setEntityType}
          onFileSelected={wizard.handleFileSelected}
          fileName={wizard.fileName}
          onFileRemoved={() => {
            wizard.setFileBase64(null);
            wizard.setFileName(null);
          }}
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
          onImport={async () => wizard.handleNext()}
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
