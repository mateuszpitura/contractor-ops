/**
 * `useSigningProgressBarPanel` — composes resend + audit + void hooks
 * and owns the audit/void open/close state. Covers:
 *   - initial state: both panels closed; audit fetch gated until opened
 *   - openVoid flips voidOpen=true (interaction)
 *   - setAuditOpen(true) triggers the audit trail query (loading branch)
 *   - audit events surface once the query resolves (success)
 *   - audit isLoading=true while the query is in flight (loading flag)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useSigningProgressBarPanel } from '../use-signing-progress-bar-panel.js';

const trpcProxy = createTRPCProxy();

describe('useSigningProgressBarPanel', () => {
  beforeEach(() => {
    setTRPCMock({});
  });

  it('starts with both audit + void dialogs closed (initial / empty state)', () => {
    setTRPCMock({
      'esign.getEnvelopeDetail': () => ({ events: [] }),
    });
    const { result } = renderHookWithProviders(() => useSigningProgressBarPanel('env-1'));
    expect(result.current.auditOpen).toBe(false);
    expect(result.current.voidOpen).toBe(false);
  });

  it('openVoid flips voidOpen=true (interaction)', () => {
    setTRPCMock({
      'esign.getEnvelopeDetail': () => ({ events: [] }),
    });
    const { result } = renderHookWithProviders(() => useSigningProgressBarPanel('env-1'));
    act(() => {
      result.current.openVoid();
    });
    expect(result.current.voidOpen).toBe(true);
  });

  it('audit isLoading=true while the audit query is pending (loading branch)', async () => {
    setTRPCMock({
      'esign.getEnvelopeDetail': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useSigningProgressBarPanel('env-1'));
    act(() => {
      result.current.setAuditOpen(true);
    });
    await waitFor(() => expect(result.current.audit.isLoading).toBe(true));
  });

  it('exposes the audit event list once the query resolves (success)', async () => {
    setTRPCMock({
      'esign.getEnvelopeDetail': () => ({
        events: [
          {
            id: 'evt-1',
            eventType: 'ENVELOPE_SENT',
            description: 'Envelope sent',
            actorName: 'Alice',
            occurredAt: '2025-05-01T00:00:00Z',
          },
        ],
      }),
    });
    const { result } = renderHookWithProviders(() => useSigningProgressBarPanel('env-1'));
    act(() => {
      result.current.setAuditOpen(true);
    });
    await waitFor(() => expect(result.current.audit.events).toHaveLength(1));
    expect(result.current.audit.events[0]?.id).toBe('evt-1');
  });

  it('exposes signing.isResendPending=false at rest (mutation idle state)', () => {
    setTRPCMock({
      'esign.getEnvelopeDetail': () => ({ events: [] }),
    });
    const { result } = renderHookWithProviders(() => useSigningProgressBarPanel('env-1'));
    expect(result.current.signing.isResendPending).toBe(false);
  });
});
