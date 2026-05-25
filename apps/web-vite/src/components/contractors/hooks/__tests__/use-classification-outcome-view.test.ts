/**
 * Hook spec for `useClassificationOutcomeView` — the outcome-screen status
 * discriminator the classification container relies on. Exercises the four
 * UI branches (loading / not-found / unsupported-country / missing-outcome
 * / ready) plus the print + rerun navigation callbacks.
 *
 * Underlying React Query / tRPC primitives are mocked at module level so
 * the spec exercises only the view-model derivation.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

type AssessmentMock = {
  id: string;
  countryCode?: string | null;
  outcome?: unknown;
  questionsSnapshot?: unknown;
  answers?: Record<string, unknown> | null;
  ruleSetVersion?: string;
  completedAt?: Date | string | null;
  disclaimerAcknowledgedAt?: Date | string | null;
};

const routerPushSpy = vi.fn<(href: string) => void>();
let mockAssessment: AssessmentMock | undefined;
let mockIsPending = false;

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: mockAssessment, isPending: mockIsPending }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/providers/trpc-provider.js', () => ({
  useTRPC: () => ({
    classification: {
      getById: { queryOptions: () => ({ queryKey: ['classification', 'getById'] }) },
      getDraft: { queryOptions: () => ({ queryKey: ['classification', 'getDraft'] }) },
      createDraft: { mutationOptions: () => ({}) },
      recreateDraftAfterDrift: { mutationOptions: () => ({}) },
    },
  }),
}));

vi.mock('@/i18n/navigation.js', () => ({
  useRouter: () => ({ push: routerPushSpy }),
}));

vi.mock('@/i18n/useTranslations.js', () => ({
  useTranslations: () => (key: string) => `t:${key}`,
}));

vi.mock('@/lib/format/use-date-formatter.js', () => ({
  useDateFormatter: () => ({
    formatDateTime: (date: Date) => `dt:${date.toISOString()}`,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const printSpy = vi.fn();
Object.defineProperty(window, 'print', { configurable: true, value: printSpy });

import { useClassificationOutcomeView } from '../use-engagement-classification.js';

afterEach(() => {
  routerPushSpy.mockReset();
  printSpy.mockReset();
  mockAssessment = undefined;
  mockIsPending = false;
});

describe('useClassificationOutcomeView', () => {
  it('returns status=loading while the assessment query is pending (loading branch)', () => {
    mockIsPending = true;
    const { result } = renderHook(() => useClassificationOutcomeView('a-1', 'c-1', 'e-1'));

    expect(result.current.status).toEqual({ kind: 'loading' });
  });

  it('returns status=not-found when the query resolves to undefined (empty / 404 branch)', () => {
    mockIsPending = false;
    mockAssessment = undefined;
    const { result } = renderHook(() => useClassificationOutcomeView('a-1', 'c-1', 'e-1'));

    expect(result.current.status).toEqual({ kind: 'not-found' });
  });

  it('returns status=unsupported-country for non-GB/DE jurisdictions (error / guard branch)', () => {
    mockIsPending = false;
    mockAssessment = {
      id: 'a-1',
      countryCode: 'AE',
      outcome: { kind: 'IR35', verdict: 'INSIDE' },
      questionsSnapshot: { items: [] },
      ruleSetVersion: '2025-01',
      completedAt: new Date('2025-01-01T00:00:00Z'),
      disclaimerAcknowledgedAt: null,
    };
    const { result } = renderHook(() => useClassificationOutcomeView('a-1', 'c-1', 'e-1'));

    expect(result.current.status).toEqual({ kind: 'unsupported-country', countryCode: 'AE' });
  });

  it('returns status=missing-outcome when outcome/snapshot are absent (null payload)', () => {
    mockIsPending = false;
    mockAssessment = {
      id: 'a-1',
      countryCode: 'GB',
      outcome: null,
      questionsSnapshot: null,
      ruleSetVersion: '2025-01',
      completedAt: new Date('2025-01-01T00:00:00Z'),
      disclaimerAcknowledgedAt: null,
    };
    const { result } = renderHook(() => useClassificationOutcomeView('a-1', 'c-1', 'e-1'));

    expect(result.current.status).toEqual({ kind: 'missing-outcome' });
  });

  it('returns status=ready with the disclaimer open when GB outcome lands unacknowledged (success)', () => {
    mockIsPending = false;
    mockAssessment = {
      id: 'a-1',
      countryCode: 'gb',
      outcome: { kind: 'IR35', verdict: 'INSIDE', areas: [] },
      questionsSnapshot: { items: [] },
      answers: { q1: 'yes' },
      ruleSetVersion: '2025-01',
      completedAt: new Date('2025-01-01T00:00:00Z'),
      disclaimerAcknowledgedAt: null,
    };
    const { result } = renderHook(() => useClassificationOutcomeView('a-1', 'c-1', 'e-1'));

    expect(result.current.status.kind).toBe('ready');
    if (result.current.status.kind === 'ready') {
      expect(result.current.status.assessment.countryCode).toBe('GB');
      expect(result.current.status.disclaimerOpen).toBe(true);
      expect(result.current.status.completedDateStr).toBe('dt:2025-01-01T00:00:00.000Z');
      expect(result.current.status.answers).toEqual({ q1: 'yes' });
    }
  });

  it('handleRerun pushes to the classification-entry route for the engagement', () => {
    mockIsPending = true;
    const { result } = renderHook(() => useClassificationOutcomeView('a-1', 'c-1', 'e-1'));

    act(() => {
      result.current.handleRerun();
    });

    expect(routerPushSpy).toHaveBeenCalledWith('/contractors/c-1/engagements/e-1/classification');
  });

  it('handlePrint calls window.print when available', () => {
    mockIsPending = true;
    const { result } = renderHook(() => useClassificationOutcomeView('a-1', 'c-1', 'e-1'));

    act(() => {
      result.current.handlePrint();
    });

    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it('handleDeferredNavigate routes back to the engagement detail when the user defers the disclaimer', () => {
    mockIsPending = true;
    const { result } = renderHook(() => useClassificationOutcomeView('a-1', 'c-1', 'e-1'));

    act(() => {
      result.current.handleDeferredNavigate();
    });

    expect(routerPushSpy).toHaveBeenCalledWith('/contractors/c-1/engagements/e-1');
  });
});
