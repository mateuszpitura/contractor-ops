/**
 * View-only test for the import wizard dialog shell.
 *
 * The presentational shell now takes a pre-built `stepBody` ReactNode
 * (container picks the variant per `currentStep`). We feed shaped stubs
 * for the dialog wiring (step indicator, footer, discard) and hand the
 * view the chosen step body directly.
 */

import { render, screen, setup } from '@/test/test-utils';
import type { useTranslations } from '../../../i18n/useTranslations';
import type {
  CommitResult,
  ImportResult,
  ImportWizardDialogViewProps,
  ParseResult,
} from '../import-wizard-dialog';
import { ImportWizardDialogView } from '../import-wizard-dialog';

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

type ViewProps = ImportWizardDialogViewProps;

function makeViewProps(overrides: Partial<ViewProps> = {}): ViewProps {
  return {
    open: true,
    t: ((key: string) => key) as ReturnType<typeof useTranslations>,
    currentStep: 0,
    showDiscardDialog: false,
    setShowDiscardDialog: vi.fn() as ViewProps['setShowDiscardDialog'],
    fileBase64: null,
    importResult: null,
    isProcessing: false,
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
    stepBody: <div data-testid="step-upload" />,
    ...overrides,
  };
}

describe('ImportWizardDialogView', () => {
  it('renders the supplied step body and footer Next button on step 0', () => {
    render(<ImportWizardDialogView {...makeViewProps()} />);
    expect(screen.getByTestId('step-upload')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('renders the mapping body when stepBody is the mapping variant', () => {
    void baseParseResult;
    render(
      <ImportWizardDialogView
        {...makeViewProps({
          currentStep: 1,
          stepBody: <div data-testid="step-mapping" />,
        })}
      />,
    );
    expect(screen.getByTestId('step-mapping')).toBeInTheDocument();
  });

  it('disables Next when canProceed is false', () => {
    render(<ImportWizardDialogView {...makeViewProps({ canProceed: false })} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('shows the processing label when isProcessing is true', () => {
    render(
      <ImportWizardDialogView
        {...makeViewProps({ isProcessing: true, getNextLabel: () => 'Next' })}
      />,
    );
    expect(screen.getByText('actions.processing')).toBeInTheDocument();
  });

  it('renders Back instead of Close once past step 0', () => {
    render(
      <ImportWizardDialogView
        {...makeViewProps({
          currentStep: 1,
          stepBody: <div data-testid="step-mapping" />,
        })}
      />,
    );
    expect(screen.getByRole('button', { name: 'actions.back' })).toBeInTheDocument();
  });

  it('fires handleClose when the dialog requests close via the cancel button', async () => {
    const handleClose = vi.fn();
    const { user } = setup(<ImportWizardDialogView {...makeViewProps({ handleClose })} />);
    await user.click(screen.getByRole('button', { name: 'actions.close' }));
    expect(handleClose).toHaveBeenCalled();
  });

  it('routes step 3 to the duplicates body when supplied', () => {
    render(
      <ImportWizardDialogView
        {...makeViewProps({
          currentStep: 3,
          stepBody: <div data-testid="step-duplicates" />,
        })}
      />,
    );
    expect(screen.getByTestId('step-duplicates')).toBeInTheDocument();
  });

  it('hides the footer once an importResult is set (terminal state)', () => {
    const importResult: CommitResult = { created: 1, updated: 0, skipped: 0, failed: 0 };
    void baseValidateResult;
    render(
      <ImportWizardDialogView
        {...makeViewProps({
          currentStep: 4,
          importResult,
          stepBody: <div data-testid="step-confirm" />,
        })}
      />,
    );
    expect(screen.getByTestId('step-confirm')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /next|back|close|discard/i }),
    ).not.toBeInTheDocument();
  });
});
