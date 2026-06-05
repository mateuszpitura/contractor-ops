/**
 * RejectionReasonDialog is presentational. Focus: validation gate, character
 * counter, bulk title.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// `@contractor-ops/ui` shadcn Dialog primitive calls `useTranslations` from
// `next-intl` directly (for the aria-label on the close button) and apps/web-vite
// renders without a NextIntlClientProvider — it uses i18next. Mock the dialog
// primitives to lightweight stubs so the component-under-test (which owns the
// useful behaviour: validation, submit, character counter) renders standalone.
vi.mock('@contractor-ops/ui/components/shadcn/dialog', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    children as React.ReactElement;
  return {
    Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
      open ? (passthrough({ children }) as React.ReactElement) : null,
    DialogContent: passthrough,
    DialogHeader: passthrough,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    DialogBody: passthrough,
    DialogFooter: passthrough,
  };
});

import { RejectionReasonDialog } from '../rejection-reason-dialog.js';
import { click, findAllByText, findButton, findByText, mount, type } from './_render.js';

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  onConfirm: vi.fn(),
  isSubmitting: false,
};

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('RejectionReasonDialog (web-vite)', () => {
  it('renders dialog title for single rejection', async () => {
    await mount(<RejectionReasonDialog {...defaultProps} />);
    // Radix dialog portals into document.body — query the whole document.
    expect(findByText(document.body, 'Reject Timesheet')).not.toBeNull();
  });

  it('renders bulk description branch when isBulk is true', async () => {
    await mount(<RejectionReasonDialog {...defaultProps} isBulk count={3} />);
    expect(
      findByText(document.body, 'All selected timesheets will be rejected with the same reason.'),
    ).not.toBeNull();
  });

  it('renders character counter at 0/500 initially', async () => {
    await mount(<RejectionReasonDialog {...defaultProps} />);
    expect(findByText(document.body, '0/500')).not.toBeNull();
  });

  it('disables the reject button when reason is below 10 characters', async () => {
    await mount(<RejectionReasonDialog {...defaultProps} />);
    const button = findAllByText(document.body, 'Reject Timesheet')
      .map(el => el.closest('button'))
      .find(b => b);
    expect(button).toBeTruthy();
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables the reject button once the reason has >= 10 characters', async () => {
    await mount(<RejectionReasonDialog {...defaultProps} />);
    const textarea = document.body.querySelector('textarea');
    expect(textarea).not.toBeNull();
    await type(textarea as HTMLTextAreaElement, 'This is a valid reason for rejection');

    const button = findAllByText(document.body, 'Reject Timesheet')
      .map(el => el.closest('button'))
      .find(b => b) as HTMLButtonElement | undefined;
    expect(button).toBeTruthy();
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('calls onConfirm with the trimmed reason when the user submits', async () => {
    const onConfirm = vi.fn();
    await mount(<RejectionReasonDialog {...defaultProps} onConfirm={onConfirm} />);
    const textarea = document.body.querySelector('textarea') as HTMLTextAreaElement;
    await type(textarea, 'This is a valid reason for rejection');
    const button = findAllByText(document.body, 'Reject Timesheet')
      .map(el => el.closest('button'))
      .find(b => b) as HTMLButtonElement;
    await click(button);
    expect(onConfirm).toHaveBeenCalledWith('This is a valid reason for rejection');
  });

  it('shows the submitting label when isSubmitting is true', async () => {
    await mount(<RejectionReasonDialog {...defaultProps} isSubmitting />);
    expect(findByText(document.body, 'Rejecting...')).not.toBeNull();
  });

  it('renders the Keep Reviewing cancel button', async () => {
    await mount(<RejectionReasonDialog {...defaultProps} />);
    expect(findButton(document.body, 'Keep Reviewing')).not.toBeNull();
  });
});
