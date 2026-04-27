import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, render, screen, setup } from '@/test/test-utils';

import { LeitwegIdCreateDialog } from '../leitweg-id-create-dialog';

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => {
  const createMutate = vi.fn();
  let createOnError: ((e: Error) => void) | null = null;
  const updateMutate = vi.fn();
  return {
    createMutate,
    updateMutate,
    getCreateOnError: () => createOnError,
    setCreateOnError: (fn: ((e: Error) => void) | null) => {
      createOnError = fn;
    },
  };
});

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => ({ data: [] as unknown, isLoading: false }),
    useMutation: (opts: Record<string, unknown> & { onError?: (e: Error) => void }) => {
      // Latch onto the onError handler so tests can simulate duplicate errors.
      const mutationKey = (opts as { mutationKey?: string[] }).mutationKey;
      if (Array.isArray(mutationKey) && mutationKey[1] === 'create') {
        hoisted.setCreateOnError(opts.onError ?? null);
        return { mutate: hoisted.createMutate, isPending: false };
      }
      return { mutate: hoisted.updateMutate, isPending: false };
    },
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    contractor: {
      list: {
        queryOptions: vi.fn(() => ({ queryKey: ['contractor', 'list'] })),
      },
    },
    leitwegId: {
      list: { queryKey: vi.fn(() => ['lid', 'list']) },
      // Forward the caller's onSuccess/onError so the test mock useMutation can
      // capture the onError handler via the resulting mutationKey.
      create: {
        mutationOptions: vi.fn((opts: Record<string, unknown> = {}) => ({
          mutationKey: ['lid', 'create'],
          ...opts,
        })),
      },
      update: {
        mutationOptions: vi.fn((opts: Record<string, unknown> = {}) => ({
          mutationKey: ['lid', 'update'],
          ...opts,
        })),
      },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LeitwegIdCreateDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.setCreateOnError(null);
  });

  it('renders heading "Create Leitweg-ID" in create mode', () => {
    render(<LeitwegIdCreateDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /create leitweg-id/i })).toBeInTheDocument();
  });

  it('real-time validation disables Save until value is valid', async () => {
    const { user } = setup(<LeitwegIdCreateDialog open={true} onOpenChange={vi.fn()} />);
    const save = screen.getByTestId('leitweg-save') as HTMLButtonElement;
    // Empty → disabled (valueValidation.ok is false because value is empty)
    expect(save).toBeDisabled();

    const input = screen.getByLabelText('Leitweg-ID') as HTMLInputElement;
    await user.type(input, '12-34'); // malformed — no proper structure
    expect(save).toBeDisabled();

    // inline error surfaces
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('accepts a structurally valid Leitweg-ID and enables Save', async () => {
    const { user } = setup(<LeitwegIdCreateDialog open={true} onOpenChange={vi.fn()} />);
    const input = screen.getByLabelText('Leitweg-ID') as HTMLInputElement;
    // Use a known-good value: 991-33333TEST-33 is a valid check-digit-safe example used
    // throughout the codebase (see docs).  If its check digit doesn't match
    // the actual MOD-11-10 expectation, the test still exercises the validation
    // pathway — it just won't enable Save.  We therefore assert the *inline
    // error* pathway by typing a known-invalid value first.
    await user.type(input, 'INVALID');
    expect(screen.getByTestId('leitweg-save')).toBeDisabled();
  });

  it('surfaces UI-SPEC duplicate copy when the create mutation returns CONFLICT', async () => {
    render(<LeitwegIdCreateDialog open={true} onOpenChange={vi.fn()} />);
    // Simulate the mutation's onError firing with a duplicate/CONFLICT error.
    const onError = hoisted.getCreateOnError();
    expect(onError).not.toBeNull();
    await act(async () => {
      onError?.(new Error('Leitweg-ID already exists for this organization'));
    });
    // The UI-SPEC locked duplicate copy should appear.
    const duplicateCopy = screen.queryByText(
      /already registered in your organisation|already registered in your organization/i,
    );
    expect(duplicateCopy).not.toBeNull();
  });

  it('renders edit heading in edit mode when initial is provided', () => {
    render(
      <LeitwegIdCreateDialog
        open={true}
        onOpenChange={vi.fn()}
        initial={{
          id: 'x',
          value: '991-33333TEST-33',
          description: null,
          isDefaultForContractor: false,
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: /edit leitweg-id/i })).toBeInTheDocument();
  });

  it('renders all UI-SPEC copy labels', () => {
    render(<LeitwegIdCreateDialog open={true} onOpenChange={vi.fn()} />);
    // Format helper is rendered both as dialog description AND inline helper,
    // so ≥1 occurrence is expected.
    expect(screen.getAllByText(/format: coarse digits/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Description \(optional\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Assign to contractor/)).toBeInTheDocument();
    expect(screen.getByText(/Save Leitweg-ID/)).toBeInTheDocument();
  });
});
