/**
 * Hook spec for `useClassificationWizardShell` — the autosave-state +
 * mutation-wiring orchestrator the wizard container wraps. tRPC, React
 * Query, and the i18n / router primitives are mocked at module level so
 * the test focuses on the shell's contract: setter plumbing flips
 * `autosaveStatus` / `lastSavedAt`, mutations surface as a single
 * `submitMutation` object, and the answer-commit callback is wired.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let onMutateHook: (() => void) | undefined;
let onSuccessHook: ((data: { updatedAt: Date }) => void) | undefined;
let onErrorHook: ((err: Error) => void) | undefined;
const submitSpy = vi.fn();
const saveAnswerSpy = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useMutation: (opts: {
    onMutate?: () => void;
    onSuccess?: (data: { updatedAt: Date }) => void;
    onError?: (err: Error) => void;
  }) => {
    if (!onMutateHook) {
      onMutateHook = opts.onMutate;
      onSuccessHook = opts.onSuccess;
      onErrorHook = opts.onError;
      return { mutate: saveAnswerSpy, status: 'idle', isPending: false };
    }
    return { mutate: submitSpy, status: 'idle', isPending: false };
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('../../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => ({
    classification: {
      saveAnswer: { mutationOptions: (opts: unknown) => opts },
      submit: { mutationOptions: (opts: unknown) => opts },
      pathFilter: () => undefined,
    },
  }),
}));

vi.mock('../../../../../i18n/navigation.js', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../../../../../i18n/useTranslations.js', () => ({
  useTranslations: () => (key: string) => `t:${key}`,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useClassificationWizardShell } from '../use-classification-wizard-shell.js';

afterEach(() => {
  onMutateHook = undefined;
  onSuccessHook = undefined;
  onErrorHook = undefined;
  submitSpy.mockReset();
  saveAnswerSpy.mockReset();
});

describe('useClassificationWizardShell', () => {
  it('initialises with autosaveStatus=idle and no last-saved timestamp (loading parity)', () => {
    const { result } = renderHook(() =>
      useClassificationWizardShell('a-1', 'c-1', 'e-1', 1_700_000_000_000),
    );

    expect(result.current.autosaveStatus).toBe('idle');
    expect(result.current.lastSavedAt).toBeNull();
    expect(typeof result.current.commitAnswer).toBe('function');
    expect(typeof result.current.submitAssessment).toBe('function');
  });

  it('flips autosaveStatus to "saving" when an answer save begins (loading branch)', () => {
    const { result } = renderHook(() =>
      useClassificationWizardShell('a-1', 'c-1', 'e-1', 1_700_000_000_000),
    );

    act(() => {
      onMutateHook?.();
    });

    expect(result.current.autosaveStatus).toBe('saving');
  });

  it('records lastSavedAt and flips status to "saved" on success (success path)', () => {
    const { result } = renderHook(() =>
      useClassificationWizardShell('a-1', 'c-1', 'e-1', 1_700_000_000_000),
    );

    const updatedAt = new Date('2025-01-01T12:00:00Z');
    act(() => {
      onSuccessHook?.({ updatedAt });
    });

    expect(result.current.autosaveStatus).toBe('saved');
    expect(result.current.lastSavedAt).toBe(updatedAt.getTime());
  });

  it('routes autosave failures to status="error" without losing the previous timestamp (error path)', () => {
    const { result } = renderHook(() =>
      useClassificationWizardShell('a-1', 'c-1', 'e-1', 1_700_000_000_000),
    );

    act(() => {
      onSuccessHook?.({ updatedAt: new Date('2025-01-01T12:00:00Z') });
    });
    act(() => {
      onErrorHook?.(new Error('network'));
    });

    expect(result.current.autosaveStatus).toBe('error');
    expect(result.current.lastSavedAt).toBe(new Date('2025-01-01T12:00:00Z').getTime());
  });

  it('commitAnswer forwards the assessmentId + answer payload to the save mutation', () => {
    const { result } = renderHook(() =>
      useClassificationWizardShell('a-1', 'c-1', 'e-1', 1_700_000_000_000),
    );

    act(() => {
      result.current.commitAnswer('q-1', { type: 'yes-no', value: 'yes' });
    });

    expect(saveAnswerSpy).toHaveBeenCalledTimes(1);
    const [payload] = saveAnswerSpy.mock.calls[0]!;
    expect(payload).toMatchObject({ assessmentId: 'a-1', questionId: 'q-1', answer: 'yes' });
  });

  it('submitAssessment dispatches the submit mutation with the assessmentId (invalidation path)', () => {
    const { result } = renderHook(() =>
      useClassificationWizardShell('a-1', 'c-1', 'e-1', 1_700_000_000_000),
    );

    act(() => {
      result.current.submitAssessment();
    });

    expect(submitSpy).toHaveBeenCalledWith({ assessmentId: 'a-1' });
  });
});
