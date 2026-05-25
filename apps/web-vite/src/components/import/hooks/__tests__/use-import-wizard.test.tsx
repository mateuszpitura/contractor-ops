/**
 * `useImportWizardDialog` is the sole tRPC boundary for the import wizard
 * (parse / validate / commit mutations + React Query invalidation).
 *
 * The harness lives in `test-utils/render-hook.tsx` — `vi.mock` swaps
 * `trpc-provider.useTRPC` for the recursive proxy that resolves
 * `trpc.import.<proc>.mutationOptions()` / `pathFilter()` against an
 * in-test handler map. Each spec sets handlers via `setTRPCMock` before
 * mounting and asserts:
 *
 *   - parse success → currentStep === 1 + suggestedMapping copied across
 *   - validate success → currentStep === 2 + validateResult populated
 *   - commit success → toast + queryClient invalidation on the entity key
 *   - parse error → toast + currentStep unchanged
 *   - close with no work-in-progress closes immediately
 *   - close with file present opens the discard confirmation alert
 *   - handleBack jumps over the duplicates step when none were detected
 */

import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../../providers/trpc-provider.js', async () => {
  const { createTRPCProxy } = await import('../../../../test-utils/render-hook.js');
  const proxy = createTRPCProxy();
  return { useTRPC: () => proxy };
});

import {
  act,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useImportWizardDialog } from '../use-import-wizard.js';

const successParse = {
  headers: ['Nazwa', 'NIP', 'Email'],
  sampleRows: [{ Nazwa: 'Acme', NIP: '111', Email: 'a@a.com' }],
  suggestedMapping: { Nazwa: 'legalName', NIP: 'taxId', Email: 'email' },
  totalRows: 1,
};

const successValidate = {
  validRows: [
    {
      rowNumber: 1,
      data: { legalName: 'Acme', taxId: '111', email: 'a@a.com' },
      status: 'valid' as const,
      errors: [],
    },
  ],
  invalidRows: [],
  duplicateRows: [],
  totalRows: 1,
  columnMapping: { Nazwa: 'legalName', NIP: 'taxId', Email: 'email' },
};

function renderWizard(onOpenChange = vi.fn(), queryClient?: QueryClient) {
  return renderHookWithProviders(
    () =>
      useImportWizardDialog({
        open: true,
        onOpenChange,
        defaultEntityType: 'contractor',
      }),
    { queryClient },
  );
}

describe('useImportWizardDialog', () => {
  beforeEach(() => {
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('starts on step 0 with no file and a disabled Next', () => {
    setTRPCMock({});
    const { result } = renderWizard();
    expect(result.current.currentStep).toBe(0);
    expect(result.current.fileBase64).toBeNull();
    expect(result.current.canProceed).toBe(false);
  });

  it('enables Next once a file is selected on step 0', () => {
    setTRPCMock({});
    const { result } = renderWizard();
    act(() => result.current.handleFileSelected('YmFzZTY0', 'data.csv'));
    expect(result.current.fileBase64).toBe('YmFzZTY0');
    expect(result.current.fileName).toBe('data.csv');
    expect(result.current.canProceed).toBe(true);
  });

  it('advances to step 1 on successful parse and copies suggested mapping', async () => {
    setTRPCMock({ 'import.parse': () => successParse });
    const { result } = renderWizard();

    act(() => result.current.handleFileSelected('YmFzZTY0', 'data.csv'));
    act(() => result.current.handleNext());

    await waitFor(() => expect(result.current.currentStep).toBe(1));
    expect(result.current.parseResult).toEqual(successParse);
    expect(result.current.columnMapping).toEqual(successParse.suggestedMapping);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('keeps step 0 and surfaces a toast when parse fails', async () => {
    setTRPCMock({
      'import.parse': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderWizard();

    act(() => result.current.handleFileSelected('YmFzZTY0', 'data.csv'));
    act(() => result.current.handleNext());

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(result.current.currentStep).toBe(0);
  });

  it('advances to step 2 on validate success and skips duplicates step when none', async () => {
    setTRPCMock({
      'import.parse': () => successParse,
      'import.validate': () => successValidate,
    });
    const { result } = renderWizard();

    act(() => result.current.handleFileSelected('YmFzZTY0', 'data.csv'));
    act(() => result.current.handleNext()); // -> parse
    await waitFor(() => expect(result.current.currentStep).toBe(1));

    act(() => result.current.handleNext()); // -> validate
    await waitFor(() => expect(result.current.currentStep).toBe(2));

    expect(result.current.validateResult?.validRows).toHaveLength(1);
    expect(result.current.hasDuplicates).toBe(false);

    act(() => result.current.handleNext()); // -> jumps to 4 (no dupes)
    expect(result.current.currentStep).toBe(4);
  });

  it('routes step 2 → step 3 when duplicates are present', async () => {
    setTRPCMock({
      'import.parse': () => successParse,
      'import.validate': () => ({
        ...successValidate,
        duplicateRows: [
          {
            rowNumber: 2,
            data: { taxId: '999', legalName: 'Dup' },
            status: 'duplicate' as const,
            errors: [],
          },
        ],
      }),
    });
    const { result } = renderWizard();

    act(() => result.current.handleFileSelected('YmFzZTY0', 'data.csv'));
    act(() => result.current.handleNext());
    await waitFor(() => expect(result.current.currentStep).toBe(1));

    act(() => result.current.handleNext());
    await waitFor(() => expect(result.current.currentStep).toBe(2));

    expect(result.current.hasDuplicates).toBe(true);
    act(() => result.current.handleNext());
    expect(result.current.currentStep).toBe(3);
  });

  it('handleBack skips the duplicates step when there are none', async () => {
    setTRPCMock({
      'import.parse': () => successParse,
      'import.validate': () => successValidate,
    });
    const { result } = renderWizard();

    act(() => result.current.handleFileSelected('YmFzZTY0', 'data.csv'));
    act(() => result.current.handleNext());
    await waitFor(() => expect(result.current.currentStep).toBe(1));
    act(() => result.current.handleNext());
    await waitFor(() => expect(result.current.currentStep).toBe(2));
    act(() => result.current.handleNext()); // jumps to 4
    expect(result.current.currentStep).toBe(4);

    act(() => result.current.handleBack());
    expect(result.current.currentStep).toBe(2);
  });

  it('commit success populates importResult and invalidates entity queries', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const commit = vi.fn(() => ({ created: 1, updated: 0, skipped: 0, failed: 0 }));
    setTRPCMock({
      'import.parse': () => successParse,
      'import.validate': () => successValidate,
      'import.commit': commit,
    });
    const { result } = renderWizard(vi.fn(), queryClient);

    act(() => result.current.handleFileSelected('YmFzZTY0', 'data.csv'));
    act(() => result.current.handleNext());
    await waitFor(() => expect(result.current.currentStep).toBe(1));
    act(() => result.current.handleNext());
    await waitFor(() => expect(result.current.currentStep).toBe(2));
    act(() => result.current.handleNext()); // step 4
    act(() => result.current.handleNext()); // commit

    await waitFor(() => expect(result.current.importResult).not.toBeNull());
    expect(result.current.importResult).toEqual({
      created: 1,
      updated: 0,
      skipped: 0,
      failed: 0,
    });
    expect(commit).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['contractor'] }),
    );
  });

  it('closes immediately when no work is in progress', () => {
    setTRPCMock({});
    const onOpenChange = vi.fn();
    const { result } = renderWizard(onOpenChange);
    act(() => result.current.handleClose());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(result.current.showDiscardDialog).toBe(false);
  });

  it('opens the discard confirmation when a file is in flight', () => {
    setTRPCMock({});
    const onOpenChange = vi.fn();
    const { result } = renderWizard(onOpenChange);
    act(() => result.current.handleFileSelected('YmFzZTY0', 'data.csv'));
    act(() => result.current.handleClose());
    expect(result.current.showDiscardDialog).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('handleDiscard resets state and closes the dialog', () => {
    setTRPCMock({});
    const onOpenChange = vi.fn();
    const { result } = renderWizard(onOpenChange);
    act(() => result.current.handleFileSelected('YmFzZTY0', 'data.csv'));
    act(() => result.current.handleDiscard());
    expect(result.current.fileBase64).toBeNull();
    expect(result.current.fileName).toBeNull();
    expect(result.current.showDiscardDialog).toBe(false);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('canProceed on step 1 requires every required field to be mapped', async () => {
    setTRPCMock({ 'import.parse': () => successParse });
    const { result } = renderWizard();

    act(() => result.current.handleFileSelected('YmFzZTY0', 'data.csv'));
    act(() => result.current.handleNext());
    await waitFor(() => expect(result.current.currentStep).toBe(1));

    expect(result.current.canProceed).toBe(true); // all 3 required mapped by suggested

    act(() => result.current.setColumnMapping({ ...successParse.suggestedMapping, NIP: null }));
    expect(result.current.canProceed).toBe(false);
  });
});
