// Phase 58 Plan 05 Task 1 — disclaimer dialog behaviour contract (D-12).
//
// Verifies locked-phrase verbatim rendering, bypass-resistance, and focus.

import { DISCLAIMER_IR35_BODY, DISCLAIMER_SCHEIN_BODY } from '@contractor-ops/validators';
import { describe, expect, it, vi } from 'vitest';

// Mock tRPC BEFORE importing the SUT so the mutationOptions path is stubbed.
const mutateSpy = vi.fn();
vi.mock('@/trpc/init', () => ({
  trpc: {
    classification: {
      acknowledgeDisclaimer: {
        mutationOptions: (opts: { onSuccess?: () => void; onError?: (e: Error) => void } = {}) => ({
          mutationFn: async (input: { assessmentId: string }) => {
            mutateSpy(input);
            opts.onSuccess?.();
            return { id: input.assessmentId, disclaimerAcknowledgedAt: new Date() };
          },
        }),
      },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { render, screen, setup } from '@/test/test-utils';

import { ClassificationDisclaimerDialog } from '../classification-disclaimer-dialog';

const onAck = vi.fn();
const onDefer = vi.fn();

describe('ClassificationDisclaimerDialog (D-12 / DD-1..DD-8)', () => {
  it('DD-1: renders DISCLAIMER_IR35_BODY verbatim for GB', () => {
    render(
      <ClassificationDisclaimerDialog
        assessmentId="a1"
        countryCode="GB"
        open={true}
        onAcknowledged={onAck}
        onDeferred={onDefer}
      />,
    );
    expect(screen.getByText(DISCLAIMER_IR35_BODY)).toBeInTheDocument();
  });

  it('DD-2: renders DISCLAIMER_SCHEIN_BODY verbatim for DE', () => {
    render(
      <ClassificationDisclaimerDialog
        assessmentId="a1"
        countryCode="DE"
        open={true}
        onAcknowledged={onAck}
        onDeferred={onDefer}
      />,
    );
    expect(screen.getByText(DISCLAIMER_SCHEIN_BODY)).toBeInTheDocument();
  });

  it('DD-3: role="alertdialog" is present on the dialog content', () => {
    render(
      <ClassificationDisclaimerDialog
        assessmentId="a1"
        countryCode="GB"
        open={true}
        onAcknowledged={onAck}
        onDeferred={onDefer}
      />,
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('DD-7: confirm button is disabled until the checkbox is ticked', async () => {
    const { user } = setup(
      <ClassificationDisclaimerDialog
        assessmentId="a1"
        countryCode="GB"
        open={true}
        onAcknowledged={onAck}
        onDeferred={onDefer}
      />,
    );
    const confirm = screen.getByRole('button', { name: /view outcome/i });
    expect(confirm).toBeDisabled();

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(confirm).not.toBeDisabled();
  });

  it('DD-8: clicking confirm fires acknowledgeDisclaimer and onAcknowledged', async () => {
    mutateSpy.mockClear();
    onAck.mockClear();
    const { user } = setup(
      <ClassificationDisclaimerDialog
        assessmentId="assessment-42"
        countryCode="GB"
        open={true}
        onAcknowledged={onAck}
        onDeferred={onDefer}
      />,
    );
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /view outcome/i }));

    expect(mutateSpy).toHaveBeenCalledWith({ assessmentId: 'assessment-42' });
    expect(onAck).toHaveBeenCalled();
  });
});
