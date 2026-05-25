/**
 * View-only test for the import wizard dialog shell.
 *
 * Verifies the step indicator + footer + step body switch off the hook
 * return shape without going near tRPC / React Query — the
 * `ImportWizardDialogView` is presentational, so we feed it a hand-built
 * `useImportWizardDialog` payload and assert the rendered surface.
 *
 * The deep step components (`StepUpload`, `StepMapping`, …) are mocked to
 * keep this test focused on dialog wiring and well under the 1s budget.
 */

import { render, screen, setup } from '@/test/test-utils';
import type { useTranslations } from '../../../i18n/useTranslations';
import type {
  CommitResult,
  ImportResult,
  ImportWizardDialogProps,
  ImportWizardDialogViewProps,
  ParseResult,
} from '../import-wizard-dialog';
import { ImportWizardDialogView } from '../import-wizard-dialog';

vi.mock('../step-upload', () => ({
  StepUpload: () => <div data-testid="step-upload" />,
}));
vi.mock('../step-mapping', () => ({
  StepMapping: () => <div data-testid="step-mapping" />,
}));
vi.mock('../step-preview', () => ({
  StepPreview: () => <div data-testid="step-preview" />,
}));
vi.mock('../step-duplicates', () => ({
  StepDuplicates: () => <div data-testid="step-duplicates" />,
}));
vi.mock('../step-confirm', () => ({
  StepConfirm: () => <div data-testid="step-confirm" />,
}));

const baseParseResult: ParseResult = {
  headers: ['A'],
  sampleRows: [],
  suggestedMapping: { A: null },
  totalRows: 0,
};

const baseValidateResult: ImportResult = {
  validRows: [],
  invalidRows: [],
  duplicateRows: [],
  totalRows: 0,
  columnMapping: { A: null },
};

type HookReturn = Omit<ImportWizardDialogViewProps, keyof ImportWizardDialogProps>;

function makeHookReturn(overrides: Partial<HookReturn> = {}): HookReturn {
  return { ...buildBase(), ...overrides };
}

function buildBase(): HookReturn {
  // `as` casts on `vi.fn()` setters mirror the hook's `as const` readonly
  // contract — the View only reads these in JSX so the cast is inert.
  return {
    t: ((key: string) => key) as ReturnType<typeof useTranslations>,
    currentStep: 0,
    showDiscardDialog: false,
    setShowDiscardDialog: vi.fn() as HookReturn['setShowDiscardDialog'],
    entityType: 'contractor',
    setEntityType: vi.fn() as HookReturn['setEntityType'],
    fileBase64: null,
    fileName: null,
    parseResult: null,
    columnMapping: {},
    setColumnMapping: vi.fn() as HookReturn['setColumnMapping'],
    validateResult: null,
    duplicateActions: {},
    setDuplicateActions: vi.fn() as HookReturn['setDuplicateActions'],
    importResult: null,
    isProcessing: false,
    commitMutation: { isPending: false } as HookReturn['commitMutation'],
    hasDuplicates: false,
    handleFileSelected: vi.fn(),
    handleClose: vi.fn(),
    handleDiscard: vi.fn(),
    handleNext: vi.fn(),
    handleBack: vi.fn(),
    canProceed: true,
    stepLabels: [
      { label: 'Upload', visible: true },
      { label: 'Mapping', visible: true },
      { label: 'Preview', visible: true },
      { label: 'Duplicates', visible: false },
      { label: 'Confirm', visible: true },
    ],
    getNextLabel: () => 'Next',
    confirmCounts: { newRecords: 0, updates: 0, skippedDuplicates: 0, skippedErrors: 0 },
    setFileBase64: vi.fn() as HookReturn['setFileBase64'],
    setFileName: vi.fn() as HookReturn['setFileName'],
  };
}

const baseProps: ImportWizardDialogProps = {
  open: true,
  onOpenChange: vi.fn(),
};

describe('ImportWizardDialogView', () => {
  it('renders the upload step body and footer Next button on step 0', () => {
    render(<ImportWizardDialogView {...baseProps} {...makeHookReturn()} />);
    expect(screen.getByTestId('step-upload')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('shows the mapping body when currentStep is 1 and parseResult is set', () => {
    render(
      <ImportWizardDialogView
        {...baseProps}
        {...makeHookReturn({ currentStep: 1, parseResult: baseParseResult })}
      />,
    );
    expect(screen.getByTestId('step-mapping')).toBeInTheDocument();
  });

  it('disables Next when canProceed is false', () => {
    render(<ImportWizardDialogView {...baseProps} {...makeHookReturn({ canProceed: false })} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('shows the processing label when isProcessing is true', () => {
    render(
      <ImportWizardDialogView
        {...baseProps}
        {...makeHookReturn({ isProcessing: true, getNextLabel: () => 'Next' })}
      />,
    );
    expect(screen.getByText('actions.processing')).toBeInTheDocument();
  });

  it('renders Back instead of Close once past step 0', () => {
    render(
      <ImportWizardDialogView
        {...baseProps}
        {...makeHookReturn({ currentStep: 1, parseResult: baseParseResult })}
      />,
    );
    expect(screen.getByRole('button', { name: 'actions.back' })).toBeInTheDocument();
  });

  it('fires handleClose when the dialog requests close via the cancel button', async () => {
    const handleClose = vi.fn();
    const { user } = setup(
      <ImportWizardDialogView {...baseProps} {...makeHookReturn({ handleClose })} />,
    );
    await user.click(screen.getByRole('button', { name: 'actions.close' }));
    expect(handleClose).toHaveBeenCalled();
  });

  it('routes step 3 to the duplicates body and hides the duplicates pill when not needed', () => {
    render(
      <ImportWizardDialogView
        {...baseProps}
        {...makeHookReturn({
          currentStep: 3,
          parseResult: baseParseResult,
          validateResult: baseValidateResult,
          hasDuplicates: true,
        })}
      />,
    );
    expect(screen.getByTestId('step-duplicates')).toBeInTheDocument();
  });

  it('hides the footer once an importResult is set (terminal state)', () => {
    render(
      <ImportWizardDialogView
        {...baseProps}
        {...makeHookReturn({
          currentStep: 4,
          validateResult: baseValidateResult,
          importResult: { created: 1, updated: 0, skipped: 0, failed: 0 },
        })}
      />,
    );
    expect(screen.getByTestId('step-confirm')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /next|back|close|discard/i }),
    ).not.toBeInTheDocument();
  });
});
