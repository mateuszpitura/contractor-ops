/**
 * Sole-boundary hook spec for the deprovisioning start path. Asserts:
 *   - contractorId-only path calls resolveAssignmentForContractor;
 *   - a stable, assignment-derived idempotencyKey;
 *   - allowed===false flows through from the cooldown gate;
 *   - startDeprovisioningRun fires with { assignmentId, idempotencyKey } and the
 *     returned runId surfaces.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import {
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../test-utils/render-hook.js';
import { deriveIdempotencyKey, useStartDeprovisioning } from '../hooks/use-start-deprovisioning.js';

const trpcProxy = createTRPCProxy();

afterEach(() => {
  clearTRPCMock();
  vi.clearAllMocks();
});

describe('useStartDeprovisioning', () => {
  it('derives a stable, assignment-namespaced idempotencyKey', () => {
    expect(deriveIdempotencyKey('asg-1')).toBe('deprov:asg-1');
    expect(deriveIdempotencyKey('asg-1')).toBe(deriveIdempotencyKey('asg-1'));
    expect(deriveIdempotencyKey('asg-1').length).toBeLessThanOrEqual(128);
  });

  it('resolves contractorId → assignmentId via the server resolver (D-01)', async () => {
    const resolver = vi.fn(() => ({ assignmentId: 'asg-from-resolver' }));
    setTRPCMock({
      'deprovisioning.resolveAssignmentForContractor': resolver,
      'deprovisioning.getDeprovisioningEligibility': () => ({ allowed: true }),
    });
    const { result } = renderHookWithProviders(() =>
      useStartDeprovisioning({ contractorId: 'ctr-1' }),
    );
    await waitFor(() => expect(result.current.assignmentId).toBe('asg-from-resolver'));
    expect(resolver).toHaveBeenCalledWith({ contractorId: 'ctr-1' });
    expect(result.current.idempotencyKey).toBe('deprov:asg-from-resolver');
  });

  it('does NOT call the resolver when an assignmentId is given directly', async () => {
    const resolver = vi.fn();
    setTRPCMock({
      'deprovisioning.resolveAssignmentForContractor': resolver,
      'deprovisioning.getDeprovisioningEligibility': () => ({ allowed: true }),
    });
    const { result } = renderHookWithProviders(() =>
      useStartDeprovisioning({ assignmentId: 'asg-direct' }),
    );
    await waitFor(() => expect(result.current.allowed).toBe(true));
    expect(resolver).not.toHaveBeenCalled();
    expect(result.current.assignmentId).toBe('asg-direct');
  });

  it('flags allowed===false during cooldown and exposes earliestDate/reason (D-11)', async () => {
    setTRPCMock({
      'deprovisioning.getDeprovisioningEligibility': () => ({
        allowed: false,
        earliestDate: '2026-06-20T00:00:00.000Z',
        reason: '14-day cooldown active',
      }),
    });
    const { result } = renderHookWithProviders(() =>
      useStartDeprovisioning({ assignmentId: 'asg-cooldown' }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.allowed).toBe(false);
    expect(result.current.earliestDate).toBe('2026-06-20T00:00:00.000Z');
    expect(result.current.reason).toBe('14-day cooldown active');
  });

  it('starts the run with { assignmentId, idempotencyKey } and surfaces the runId (D-03/D-09)', async () => {
    const start = vi.fn((_vars: unknown) => ({ runId: 'run-99', idempotent: false }));
    setTRPCMock({
      'deprovisioning.getDeprovisioningEligibility': () => ({ allowed: true }),
      'deprovisioning.startDeprovisioningRun': start,
    });
    const { result } = renderHookWithProviders(() =>
      useStartDeprovisioning({ assignmentId: 'asg-start' }),
    );
    await waitFor(() => expect(result.current.allowed).toBe(true));

    await act(async () => {
      result.current.start();
    });

    await waitFor(() => expect(result.current.startedRunId).toBe('run-99'));
    expect(start).toHaveBeenCalledWith({
      subjectType: 'CONTRACTOR',
      assignmentId: 'asg-start',
      idempotencyKey: 'deprov:asg-start',
    });
  });

  it('treats a null resolver result as unresolved (no ENDED assignment)', async () => {
    setTRPCMock({
      'deprovisioning.resolveAssignmentForContractor': () => ({ assignmentId: null }),
      'deprovisioning.getDeprovisioningEligibility': vi.fn(),
    });
    const { result } = renderHookWithProviders(() =>
      useStartDeprovisioning({ contractorId: 'ctr-none' }),
    );
    await waitFor(() => expect(result.current.isUnresolved).toBe(true));
    expect(result.current.assignmentId).toBeNull();
    expect(result.current.idempotencyKey).toBeNull();
  });
});
