/**
 * Web-vite split: `NewPaymentRunDialogView` is now a thin dialog shell
 * (frame + step indicator + children slot). Step variant routing lives in wired `NewPaymentRunDialog`. Tests cover the shell rendering and
 * close behaviour with arbitrary children.
 */

import { render, screen, setup } from '@/test/test-utils';

import { NewPaymentRunDialogView } from '../new-payment-run-dialog-view';

describe('NewPaymentRunDialogView', () => {
  it('renders the dialog title and children when open', () => {
    render(
      <NewPaymentRunDialogView open step={1} onOpenChange={vi.fn()}>
        <div>step-1-body</div>
      </NewPaymentRunDialogView>,
    );
    expect(screen.getByText('New payment run')).toBeInTheDocument();
    expect(screen.getByText('step-1-body')).toBeInTheDocument();
  });

  it('renders the children for the current step variant', () => {
    render(
      <NewPaymentRunDialogView open step={2} onOpenChange={vi.fn()}>
        <div>review-body</div>
      </NewPaymentRunDialogView>,
    );
    expect(screen.getByText('review-body')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(
      <NewPaymentRunDialogView open={false} step={1} onOpenChange={vi.fn()}>
        <div>hidden-body</div>
      </NewPaymentRunDialogView>,
    );
    expect(screen.queryByText('New payment run')).not.toBeInTheDocument();
  });

  it('invokes onOpenChange when the dialog requests close', async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(
      <NewPaymentRunDialogView open step={1} onOpenChange={onOpenChange}>
        <button type="button">in-step</button>
      </NewPaymentRunDialogView>,
    );
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalled();
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
  });
});
