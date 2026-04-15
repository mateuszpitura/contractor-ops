import { beforeEach, describe, expect, it, vi } from 'vitest';

const mutationCalls: Record<string, ReturnType<typeof vi.fn>> = {
  convert: vi.fn(),
  confirmMatch: vi.fn(),
  acknowledge: vi.fn(),
  reject: vi.fn(),
};

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  );
  let mutationCallCount = 0;
  const mutationKeys = ['convert', 'confirmMatch', 'acknowledge', 'reject'] as const;
  return {
    ...actual,
    useMutation: (options: { onSuccess?: unknown; onError?: unknown }) => {
      // Return distinct mutate per call-site based on insertion order.
      const key = mutationKeys[mutationCallCount % mutationKeys.length];
      mutationCallCount += 1;
      const mutate = mutationCalls[key];
      return {
        mutate,
        mutateAsync: mutate,
        isPending: false,
        reset: vi.fn(),
        options,
      };
    },
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    invoiceIntake: {
      convertToInvoice: { mutationOptions: (opts: unknown) => opts ?? {} },
      confirmMatch: { mutationOptions: (opts: unknown) => opts ?? {} },
      acknowledgeValidation: { mutationOptions: (opts: unknown) => opts ?? {} },
      reject: { mutationOptions: (opts: unknown) => opts ?? {} },
      getById: { queryKey: () => ['invoiceIntake', 'getById'] },
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

import { screen, setup, waitFor } from '@/test/test-utils';
import { IntakeDetailActionsBar } from '../intake-detail-actions-bar';

beforeEach(() => {
  Object.values(mutationCalls).forEach(fn => fn.mockReset());
});

describe('IntakeDetailActionsBar', () => {
  it('disables Convert when status is PARSED with WARNINGS and no ack; exposes the tooltip', () => {
    setup(
      <IntakeDetailActionsBar
        intakeId="ck_intake_1"
        status="PARSED"
        validationStatus="WARNINGS"
        validationAcknowledgedAt={null}
        hasSelectedCandidate={false}
      />,
    );
    const convert = screen.getByTestId('intake-convert-cta');
    expect(convert).toBeDisabled();
    // `aria-describedby` wires the Tooltip id so AT users hear "Match a
    // contractor before converting" first (match gate fires before ack gate).
    expect(convert.getAttribute('aria-describedby')).toBe('intake-convert-tooltip');
  });

  it('enables Convert when status is MATCHED AND validation is acknowledged', () => {
    setup(
      <IntakeDetailActionsBar
        intakeId="ck_intake_2"
        status="MATCHED"
        validationStatus="WARNINGS"
        validationAcknowledgedAt={new Date('2026-04-15')}
        hasSelectedCandidate={false}
      />,
    );
    const convert = screen.getByTestId('intake-convert-cta');
    expect(convert).not.toBeDisabled();
  });

  it('opens the AlertDialog when Reject is clicked and shows the reason textarea', async () => {
    const { user } = setup(
      <IntakeDetailActionsBar
        intakeId="ck_intake_3"
        status="PARSED"
        validationStatus="VALID"
        validationAcknowledgedAt={null}
        hasSelectedCandidate={false}
      />,
    );
    await user.click(screen.getByTestId('intake-reject-trigger'));
    await waitFor(() => expect(screen.getByTestId('intake-reject-reason-input')).toBeInTheDocument());
    // The textarea is the first focusable inside the dialog — destructive
    // button is NOT auto-focused per UI-SPEC § Accessibility.
    const textarea = screen.getByTestId('intake-reject-reason-input');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(screen.getByTestId('intake-reject-confirm')).toBeInTheDocument();
    expect(screen.getByTestId('intake-reject-cancel')).toBeInTheDocument();
  });

  it('rejects a <3 character reason with an inline error and does NOT call the mutation', async () => {
    const { user } = setup(
      <IntakeDetailActionsBar
        intakeId="ck_intake_4"
        status="PARSED"
        validationStatus="VALID"
        validationAcknowledgedAt={null}
        hasSelectedCandidate={false}
      />,
    );
    await user.click(screen.getByTestId('intake-reject-trigger'));
    const textarea = await screen.findByTestId('intake-reject-reason-input');
    await user.type(textarea, 'a');
    await user.click(screen.getByTestId('intake-reject-confirm'));
    // Inline error appears, mutation not fired.
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(mutationCalls.reject).not.toHaveBeenCalled();
  });
});
