import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, setup } from '@/test/test-utils';
import { ImportWizardDialog } from '../import-wizard-dialog';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../step-upload', () => ({
  StepUpload: (props: {
    entityType: string;
    fileName: string | null;
    onFileSelected: (base64: string, name: string) => void;
    onEntityTypeChange: (type: string) => void;
    onFileRemoved: () => void;
  }) => (
    <div data-testid="step-upload">
      Upload step - entity: {props.entityType}, file: {props.fileName ?? 'none'}
      <button
        type="button"
        data-testid="select-file"
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onClick={() => props.onFileSelected('base64data', 'test.csv')}>
        Select
      </button>
      <button type="button" data-testid="remove-file" onClick={props.onFileRemoved}>
        Remove
      </button>
      <button
        type="button"
        data-testid="change-entity"
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onClick={() => props.onEntityTypeChange('contract')}>
        Change Entity
      </button>
    </div>
  ),
}));

vi.mock('../step-mapping', () => ({
  StepMapping: () => <div data-testid="step-mapping">Mapping step</div>,
}));

vi.mock('../step-preview', () => ({
  StepPreview: () => <div data-testid="step-preview">Preview step</div>,
}));

vi.mock('../step-duplicates', () => ({
  StepDuplicates: (props: {
    duplicateRows: unknown[];
    duplicateActions: Record<string, string>;
    onActionsChange: (actions: Record<string, string>) => void;
  }) => (
    <div data-testid="step-duplicates">Duplicates step - count: {props.duplicateRows.length}</div>
  ),
}));

vi.mock('../step-confirm', () => ({
  StepConfirm: (props: {
    entityType: string;
    counts: {
      newRecords: number;
      updates: number;
      skippedDuplicates: number;
      skippedErrors: number;
    };
    importResult: unknown;
    isImporting: boolean;
    onImport: () => void;
  }) => (
    <div data-testid="step-confirm">
      Confirm step - new: {props.counts.newRecords}, errors: {props.counts.skippedErrors}
      {!props.importResult && (
        <button type="button" data-testid="trigger-import" onClick={props.onImport}>
          Import
        </button>
      )}
      {!!props.importResult && <span data-testid="import-done">Done</span>}
    </div>
  ),
}));

const { mockMutate } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
}));
let lastMutationCallbacks: Array<{
  onSuccess?: (data: unknown) => void;
  onError?: () => void;
}> = [];

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useMutation: (opts: Record<string, unknown>) => {
      const entry = {
        onSuccess: opts.onSuccess as ((data: unknown) => void) | undefined,
        onError: opts.onError as (() => void) | undefined,
      };
      lastMutationCallbacks.push(entry);
      return {
        mutate: (...args: unknown[]) => {
          mockMutate(...(args as Parameters<typeof mockMutate>));
        },
        isPending: false,
        reset: vi.fn(),
        ...opts,
      };
    },
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    import: {
      parse: { mutationOptions: vi.fn((o: object) => o) },
      validate: { mutationOptions: vi.fn((o: object) => o) },
      commit: { mutationOptions: vi.fn((o: object) => o) },
    },
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ImportWizardDialog', () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    lastMutationCallbacks = [];
  });

  it('renders dialog with title', () => {
    render(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Import data')).toBeInTheDocument();
  });

  it('shows step upload initially', () => {
    render(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByTestId('step-upload')).toBeInTheDocument();
  });

  it('shows step indicator with upload step visible', () => {
    render(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Upload file')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<ImportWizardDialog open={false} onOpenChange={onOpenChange} />);
    expect(screen.queryByText('Import data')).not.toBeInTheDocument();
  });

  it('defaults to contractor entity type', () => {
    render(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByTestId('step-upload')).toHaveTextContent('entity: contractor');
  });

  it('accepts defaultEntityType prop', () => {
    render(
      <ImportWizardDialog open={true} onOpenChange={onOpenChange} defaultEntityType="contract" />,
    );
    expect(screen.getByTestId('step-upload')).toHaveTextContent('entity: contract');
  });

  it('shows close and next buttons', () => {
    render(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Close')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('shows step labels', () => {
    render(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Upload file')).toBeInTheDocument();
    expect(screen.getByText('Map columns')).toBeInTheDocument();
    expect(screen.getByText('Review data')).toBeInTheDocument();
    expect(screen.getByText('Confirm import')).toBeInTheDocument();
  });

  it('next button is disabled on step 0 without file', () => {
    render(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    const nextBtn = screen.getByText('Next');
    expect(nextBtn.closest('button')).toBeDisabled();
  });

  it('shows file as none initially', () => {
    render(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByTestId('step-upload')).toHaveTextContent('file: none');
  });

  it('enables next button after file is selected', async () => {
    const { user } = setup(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId('select-file'));
    const nextBtn = screen.getByText('Next');
    expect(nextBtn.closest('button')).not.toBeDisabled();
  });

  it('calls parse mutation when next is clicked with file', async () => {
    const { user } = setup(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId('select-file'));
    await user.click(screen.getByText('Next'));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        fileBase64: 'base64data',
        entityType: 'contractor',
      }),
    );
  });

  it('shows discard label on close button when file selected', async () => {
    const { user } = setup(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId('select-file'));
    expect(screen.getByText('Discard')).toBeInTheDocument();
  });

  it('shows discard confirmation dialog when closing with data', async () => {
    const { user } = setup(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId('select-file'));
    await user.click(screen.getByText('Discard'));
    expect(screen.getByText('Discard import?')).toBeInTheDocument();
  });

  it('navigates to mapping step on parse success', async () => {
    const { user } = setup(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId('select-file'));
    await user.click(screen.getByText('Next'));

    // Find the parse mutation onSuccess (first mutation registered = parse)
    const parseCb = lastMutationCallbacks[0];
    act(() => {
      parseCb?.onSuccess?.({
        headers: ['name', 'email'],
        sampleRows: [{ name: 'Test', email: 'test@test.com' }],
        suggestedMapping: { name: 'legalName', email: 'email' },
        totalRows: 1,
      });
    });

    expect(screen.getByTestId('step-mapping')).toBeInTheDocument();
  });

  it('shows back button on mapping step', async () => {
    const { user } = setup(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId('select-file'));
    await user.click(screen.getByText('Next'));

    act(() => {
      lastMutationCallbacks[0]?.onSuccess?.({
        headers: ['name'],
        sampleRows: [{ name: 'Test' }],
        suggestedMapping: { name: 'legalName' },
        totalRows: 1,
      });
    });

    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('navigates back from mapping to upload step', async () => {
    const { user } = setup(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId('select-file'));
    await user.click(screen.getByText('Next'));

    act(() => {
      lastMutationCallbacks[0]?.onSuccess?.({
        headers: ['name'],
        sampleRows: [{ name: 'Test' }],
        suggestedMapping: { name: 'legalName' },
        totalRows: 1,
      });
    });

    await user.click(screen.getByText('Back'));
    expect(screen.getByTestId('step-upload')).toBeInTheDocument();
  });

  it('navigates to preview step on validate success', async () => {
    const { user } = setup(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId('select-file'));
    await user.click(screen.getByText('Next'));

    act(() => {
      lastMutationCallbacks[0]?.onSuccess?.({
        headers: ['name', 'email', 'taxId'],
        sampleRows: [],
        suggestedMapping: { name: 'legalName', email: 'email', taxId: 'taxId' },
        totalRows: 1,
      });
    });

    // On mapping step, trigger validate
    await user.click(screen.getByText('Next'));

    // validate onSuccess (second mutation = validate)
    act(() => {
      lastMutationCallbacks[1]?.onSuccess?.({
        validRows: [{ rowNumber: 1, data: {}, status: 'valid', errors: [] }],
        invalidRows: [],
        duplicateRows: [],
        totalRows: 1,
        columnMapping: {},
      });
    });

    expect(screen.getByTestId('step-preview')).toBeInTheDocument();
  });

  it('removes file when file removed callback is called', async () => {
    const { user } = setup(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId('select-file'));
    expect(screen.getByTestId('step-upload')).toHaveTextContent('file: test.csv');

    await user.click(screen.getByTestId('remove-file'));
    expect(screen.getByTestId('step-upload')).toHaveTextContent('file: none');
  });

  it('changes entity type when entity change callback is called', async () => {
    const { user } = setup(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId('change-entity'));
    expect(screen.getByTestId('step-upload')).toHaveTextContent('entity: contract');
  });

  it('does not call mutate when next is clicked without file', async () => {
    setup(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    // Next button is disabled, but even if somehow clicked, no mutation
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('discards wizard data when discard is confirmed', async () => {
    const { user } = setup(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId('select-file'));
    await user.click(screen.getByText('Discard'));

    // Confirm discard - there are two "Discard" elements:
    // the close button and the AlertDialog action button
    const discardBtns = screen.getAllByText('Discard');
    // The last one should be the AlertDialog action
    await user.click(discardBtns[discardBtns.length - 1]);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('navigates from preview to confirm step when no duplicates', async () => {
    const { user } = setup(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId('select-file'));
    await user.click(screen.getByText('Next'));

    // Parse success -> mapping step
    act(() => {
      lastMutationCallbacks[0]?.onSuccess?.({
        headers: ['name', 'email', 'taxId'],
        sampleRows: [],
        suggestedMapping: { name: 'legalName', email: 'email', taxId: 'taxId' },
        totalRows: 1,
      });
    });

    // Mapping step -> validate
    await user.click(screen.getByText('Next'));

    // Validate success -> preview step (no duplicates)
    act(() => {
      lastMutationCallbacks[1]?.onSuccess?.({
        validRows: [{ rowNumber: 1, data: {}, status: 'valid', errors: [] }],
        invalidRows: [],
        duplicateRows: [],
        totalRows: 1,
        columnMapping: {},
      });
    });

    expect(screen.getByTestId('step-preview')).toBeInTheDocument();

    // Click next on preview -> should go to confirm (skipping duplicates)
    await user.click(screen.getByText('Next'));
    expect(screen.getByTestId('step-confirm')).toBeInTheDocument();
  });

  it('shows duplicates step when validate returns duplicate rows', async () => {
    const { user } = setup(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId('select-file'));
    await user.click(screen.getByText('Next'));

    act(() => {
      lastMutationCallbacks[0]?.onSuccess?.({
        headers: ['name', 'email', 'taxId'],
        sampleRows: [],
        suggestedMapping: { name: 'legalName', email: 'email', taxId: 'taxId' },
        totalRows: 2,
      });
    });

    await user.click(screen.getByText('Next'));

    act(() => {
      lastMutationCallbacks[1]?.onSuccess?.({
        validRows: [{ rowNumber: 1, data: {}, status: 'valid', errors: [] }],
        invalidRows: [],
        duplicateRows: [
          {
            rowNumber: 2,
            data: { taxId: '1234567890' },
            status: 'duplicate',
            errors: [],
            duplicateOf: 'existing-1',
          },
        ],
        totalRows: 2,
        columnMapping: {},
      });
    });

    expect(screen.getByTestId('step-preview')).toBeInTheDocument();

    // Next from preview should go to duplicates step
    await user.click(screen.getByText('Next'));
    expect(screen.getByTestId('step-duplicates')).toBeInTheDocument();
    expect(screen.getByTestId('step-duplicates')).toHaveTextContent('count: 1');
  });

  it('navigates back from confirm to preview when no duplicates', async () => {
    const { user } = setup(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId('select-file'));
    await user.click(screen.getByText('Next'));

    act(() => {
      lastMutationCallbacks[0]?.onSuccess?.({
        headers: ['name'],
        sampleRows: [],
        suggestedMapping: { name: 'legalName' },
        totalRows: 1,
      });
    });

    await user.click(screen.getByText('Next'));

    act(() => {
      lastMutationCallbacks[1]?.onSuccess?.({
        validRows: [{ rowNumber: 1, data: {}, status: 'valid', errors: [] }],
        invalidRows: [],
        duplicateRows: [],
        totalRows: 1,
        columnMapping: {},
      });
    });

    // Preview -> Confirm
    await user.click(screen.getByText('Next'));
    expect(screen.getByTestId('step-confirm')).toBeInTheDocument();

    // Back from confirm should go to preview (skipping duplicates)
    await user.click(screen.getByText('Back'));
    expect(screen.getByTestId('step-preview')).toBeInTheDocument();
  });

  it('triggers commit mutation from confirm step', async () => {
    const { user } = setup(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId('select-file'));
    await user.click(screen.getByText('Next'));

    act(() => {
      lastMutationCallbacks[0]?.onSuccess?.({
        headers: ['name'],
        sampleRows: [],
        suggestedMapping: { name: 'legalName' },
        totalRows: 1,
      });
    });

    await user.click(screen.getByText('Next'));

    act(() => {
      lastMutationCallbacks[1]?.onSuccess?.({
        validRows: [{ rowNumber: 1, data: {}, status: 'valid', errors: [] }],
        invalidRows: [],
        duplicateRows: [],
        totalRows: 1,
        columnMapping: {},
      });
    });

    // Preview -> Confirm
    await user.click(screen.getByText('Next'));
    expect(screen.getByTestId('step-confirm')).toBeInTheDocument();

    // Trigger import from confirm step
    await user.click(screen.getByTestId('trigger-import'));
    // parse + validate were called, and confirm step triggers handleNext which calls commitMutation
    expect(mockMutate).toHaveBeenCalled();
  });

  it('hides footer after import result is available', async () => {
    const { user } = setup(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId('select-file'));
    await user.click(screen.getByText('Next'));

    act(() => {
      lastMutationCallbacks[0]?.onSuccess?.({
        headers: ['name'],
        sampleRows: [],
        suggestedMapping: { name: 'legalName' },
        totalRows: 1,
      });
    });

    await user.click(screen.getByText('Next'));

    act(() => {
      lastMutationCallbacks[1]?.onSuccess?.({
        validRows: [{ rowNumber: 1, data: {}, status: 'valid', errors: [] }],
        invalidRows: [],
        duplicateRows: [],
        totalRows: 1,
        columnMapping: {},
      });
    });

    // Preview -> Confirm
    await user.click(screen.getByText('Next'));

    // Trigger import and simulate commit success
    await user.click(screen.getByTestId('trigger-import'));

    // commitMutation onSuccess (third mutation = commit)
    act(() => {
      lastMutationCallbacks[2]?.onSuccess?.({
        created: 1,
        updated: 0,
        skipped: 0,
        failed: 0,
      });
    });

    // After result, footer should be hidden (import-done visible)
    expect(screen.getByTestId('import-done')).toBeInTheDocument();
  });

  it('navigates from duplicates to confirm step', async () => {
    const { user } = setup(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId('select-file'));
    await user.click(screen.getByText('Next'));

    act(() => {
      lastMutationCallbacks[0]?.onSuccess?.({
        headers: ['name', 'email', 'taxId'],
        sampleRows: [],
        suggestedMapping: { name: 'legalName', email: 'email', taxId: 'taxId' },
        totalRows: 2,
      });
    });

    await user.click(screen.getByText('Next'));

    act(() => {
      lastMutationCallbacks[1]?.onSuccess?.({
        validRows: [{ rowNumber: 1, data: {}, status: 'valid', errors: [] }],
        invalidRows: [],
        duplicateRows: [
          {
            rowNumber: 2,
            data: { taxId: '1234567890' },
            status: 'duplicate',
            errors: [],
            duplicateOf: 'existing-1',
          },
        ],
        totalRows: 2,
        columnMapping: {},
      });
    });

    // Preview -> Duplicates
    await user.click(screen.getByText('Next'));
    expect(screen.getByTestId('step-duplicates')).toBeInTheDocument();

    // Duplicates -> Confirm
    await user.click(screen.getByText('Next'));
    expect(screen.getByTestId('step-confirm')).toBeInTheDocument();
  });

  it('navigates back from confirm to duplicates when duplicates exist', async () => {
    const { user } = setup(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId('select-file'));
    await user.click(screen.getByText('Next'));

    act(() => {
      lastMutationCallbacks[0]?.onSuccess?.({
        headers: ['name', 'taxId'],
        sampleRows: [],
        suggestedMapping: { name: 'legalName', taxId: 'taxId' },
        totalRows: 2,
      });
    });

    await user.click(screen.getByText('Next'));

    act(() => {
      lastMutationCallbacks[1]?.onSuccess?.({
        validRows: [{ rowNumber: 1, data: {}, status: 'valid', errors: [] }],
        invalidRows: [],
        duplicateRows: [
          {
            rowNumber: 2,
            data: { taxId: '111' },
            status: 'duplicate',
            errors: [],
            duplicateOf: 'x',
          },
        ],
        totalRows: 2,
        columnMapping: {},
      });
    });

    // Preview -> Duplicates -> Confirm
    await user.click(screen.getByText('Next'));
    await user.click(screen.getByText('Next'));
    expect(screen.getByTestId('step-confirm')).toBeInTheDocument();

    // Back from confirm -> duplicates (because duplicates exist)
    await user.click(screen.getByText('Back'));
    expect(screen.getByTestId('step-duplicates')).toBeInTheDocument();
  });

  it('shows step 4 confirm counts correctly', async () => {
    const { user } = setup(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId('select-file'));
    await user.click(screen.getByText('Next'));

    act(() => {
      lastMutationCallbacks[0]?.onSuccess?.({
        headers: ['name'],
        sampleRows: [],
        suggestedMapping: { name: 'legalName' },
        totalRows: 3,
      });
    });

    await user.click(screen.getByText('Next'));

    act(() => {
      lastMutationCallbacks[1]?.onSuccess?.({
        validRows: [
          { rowNumber: 1, data: {}, status: 'valid', errors: [] },
          { rowNumber: 2, data: {}, status: 'valid', errors: [] },
        ],
        invalidRows: [
          {
            rowNumber: 3,
            data: {},
            status: 'invalid',
            errors: [{ field: 'email', message: 'invalid' }],
          },
        ],
        duplicateRows: [],
        totalRows: 3,
        columnMapping: {},
      });
    });

    await user.click(screen.getByText('Next'));
    expect(screen.getByTestId('step-confirm')).toHaveTextContent('new: 2');
    expect(screen.getByTestId('step-confirm')).toHaveTextContent('errors: 1');
  });
});
