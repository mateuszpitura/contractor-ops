/**
 * web-vite port. View is `ClassificationDisclaimerDialogView`; the tRPC ack
 * mutation is injected via `acknowledge`/`isPending` props.
 */

import { DISCLAIMER_IR35_BODY, DISCLAIMER_SCHEIN_BODY } from '@contractor-ops/validators';
import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '../../../../test/test-utils.js';
import { ClassificationDisclaimerDialogView } from '../classification-disclaimer-dialog.js';

describe('ClassificationDisclaimerDialogView (D-12)', () => {
  it('DD-1: renders DISCLAIMER_IR35_BODY verbatim for GB', () => {
    render(
      <ClassificationDisclaimerDialogView
        assessmentId="a1"
        countryCode="GB"
        open={true}
        onAcknowledged={vi.fn()}
        onDeferred={vi.fn()}
        acknowledge={vi.fn()}
        isPending={false}
      />,
    );
    expect(screen.getByText(DISCLAIMER_IR35_BODY)).toBeInTheDocument();
  });

  it('DD-2: renders DISCLAIMER_SCHEIN_BODY verbatim for DE', () => {
    render(
      <ClassificationDisclaimerDialogView
        assessmentId="a1"
        countryCode="DE"
        open={true}
        onAcknowledged={vi.fn()}
        onDeferred={vi.fn()}
        acknowledge={vi.fn()}
        isPending={false}
      />,
    );
    expect(screen.getByText(DISCLAIMER_SCHEIN_BODY)).toBeInTheDocument();
  });

  it('DD-3: role="alertdialog" is present on the dialog content', () => {
    render(
      <ClassificationDisclaimerDialogView
        assessmentId="a1"
        countryCode="GB"
        open={true}
        onAcknowledged={vi.fn()}
        onDeferred={vi.fn()}
        acknowledge={vi.fn()}
        isPending={false}
      />,
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('DD-7: confirm button is disabled until the checkbox is ticked', async () => {
    const { user } = setup(
      <ClassificationDisclaimerDialogView
        assessmentId="a1"
        countryCode="GB"
        open={true}
        onAcknowledged={vi.fn()}
        onDeferred={vi.fn()}
        acknowledge={vi.fn()}
        isPending={false}
      />,
    );
    const confirm = screen.getByRole('button', { name: /view outcome/i });
    expect(confirm).toBeDisabled();

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);
    expect(confirm).not.toBeDisabled();
  });

  it('DD-8: clicking confirm invokes acknowledge', async () => {
    const acknowledge = vi.fn();
    const { user } = setup(
      <ClassificationDisclaimerDialogView
        assessmentId="assessment-42"
        countryCode="GB"
        open={true}
        onAcknowledged={vi.fn()}
        onDeferred={vi.fn()}
        acknowledge={acknowledge}
        isPending={false}
      />,
    );
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /view outcome/i }));
    expect(acknowledge).toHaveBeenCalledTimes(1);
  });
});
