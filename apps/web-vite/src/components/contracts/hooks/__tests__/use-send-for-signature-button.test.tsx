/**
 * `useSendForSignatureButton` — gates the "Send for signature" CTA. Covers:
 *   - hidden for statuses outside the DRAFT/ACTIVE allow-list (empty state)
 *   - disabled with the "no document" tooltip when hasDocument=false (error gate)
 *   - disabled with the "no provider" tooltip when no e-sign connection (error gate)
 *   - enabled with no tooltip when both prerequisites are met (success)
 *   - openDialog flips dialogOpen=true (interaction)
 */

import { describe, expect, it } from 'vitest';

import { act, renderHookWithProviders } from '../../../../test-utils/render-hook.js';
import { useSendForSignatureButton } from '../use-send-for-signature-button.js';

describe('useSendForSignatureButton', () => {
  it('returns isVisible=false for non-DRAFT / non-ACTIVE statuses (empty UI branch)', () => {
    const { result } = renderHookWithProviders(() =>
      useSendForSignatureButton({
        contractStatus: 'TERMINATED',
        hasDocument: true,
        hasConnectedProvider: true,
      }),
    );
    expect(result.current.isVisible).toBe(false);
  });

  it('is visible but disabled with a "no document" tooltip when the contract has no document', () => {
    const { result } = renderHookWithProviders(() =>
      useSendForSignatureButton({
        contractStatus: 'DRAFT',
        hasDocument: false,
        hasConnectedProvider: true,
      }),
    );
    expect(result.current.isVisible).toBe(true);
    expect(result.current.isDisabled).toBe(true);
    expect(result.current.tooltipMessage).toBeTruthy();
  });

  it('is visible but disabled with a "no provider" tooltip when there is no e-sign connection', () => {
    const { result } = renderHookWithProviders(() =>
      useSendForSignatureButton({
        contractStatus: 'ACTIVE',
        hasDocument: true,
        hasConnectedProvider: false,
      }),
    );
    expect(result.current.isVisible).toBe(true);
    expect(result.current.isDisabled).toBe(true);
    expect(result.current.tooltipMessage).toBeTruthy();
  });

  it('is enabled with no tooltip when document + provider are present (success path)', () => {
    const { result } = renderHookWithProviders(() =>
      useSendForSignatureButton({
        contractStatus: 'DRAFT',
        hasDocument: true,
        hasConnectedProvider: true,
      }),
    );
    expect(result.current.isVisible).toBe(true);
    expect(result.current.isDisabled).toBe(false);
    expect(result.current.tooltipMessage).toBeUndefined();
  });

  it('openDialog toggles dialogOpen to true (interaction)', () => {
    const { result } = renderHookWithProviders(() =>
      useSendForSignatureButton({
        contractStatus: 'DRAFT',
        hasDocument: true,
        hasConnectedProvider: true,
      }),
    );
    expect(result.current.dialogOpen).toBe(false);
    act(() => {
      result.current.openDialog();
    });
    expect(result.current.dialogOpen).toBe(true);
  });
});
