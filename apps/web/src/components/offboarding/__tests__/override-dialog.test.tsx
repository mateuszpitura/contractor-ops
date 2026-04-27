// Phase 74 Plan 08 — RTL tests for OverrideDialog dual-validation + dirty-check.

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OverrideDialog } from '../override-dialog';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      title: 'Override IP verification block',
      description:
        'Owners can complete this offboarding without IP verification. The override is permanent and recorded in the audit log.',
      reasonLabel: 'Reason for override',
      reasonPlaceholder: 'Describe why IP verification is being bypassed (minimum 20 characters).',
      reasonClientError: 'Provide at least 20 characters explaining the override.',
      reasonServerError:
        'The reason must be at least 20 characters and contain a substantive explanation.',
      acknowledgement:
        'I confirm IP verification is being intentionally bypassed and I accept responsibility for any compliance gap.',
      cta: 'Override',
      ctaLoading: 'Recording override…',
      cancel: 'Cancel',
      'discardConfirm.title': 'Discard the override reason?',
      'discardConfirm.body': 'You typed an override reason. Closing now will discard it.',
      'discardConfirm.confirm': 'Discard',
      'discardConfirm.cancel': 'Keep editing',
    };
    return map[key] ?? key;
  },
}));

const noopOpen = vi.fn();
const noopSubmit = vi.fn(async (_input: unknown): Promise<void> => undefined);

describe('OverrideDialog — D-10 dual-validation', () => {
  it('submit disabled until reason >= 20 chars AND acknowledged', () => {
    render(
      <OverrideDialog
        workflowRunId="run-1"
        open={true}
        onOpenChange={noopOpen}
        onSubmit={noopSubmit}
      />,
    );
    const submit = screen.getByRole('button', { name: /^Override$/ });
    expect(submit).toBeDisabled();

    // Short reason — still disabled
    fireEvent.change(screen.getByLabelText(/Reason for override/), {
      target: { value: 'too short' },
    });
    expect(submit).toBeDisabled();

    // Reason >= 20 — but acknowledgement not checked yet
    fireEvent.change(screen.getByLabelText(/Reason for override/), {
      target: { value: 'This is a sufficiently long reason explaining the override.' },
    });
    expect(submit).toBeDisabled();

    // Click acknowledge — submit enabled
    const ack = screen.getByRole('checkbox', { name: /intentionally bypassed/i });
    fireEvent.click(ack);
    expect(submit).toBeEnabled();
  });

  it('server error renders inline above CTA on Zod failure', () => {
    render(
      <OverrideDialog
        workflowRunId="run-1"
        open={true}
        onOpenChange={noopOpen}
        onSubmit={noopSubmit}
        serverError="The reason must be at least 20 characters and contain a substantive explanation."
      />,
    );
    expect(
      screen.getByRole('alert', { name: '' /* AlertDialog uses text content */ }),
    ).toHaveTextContent(/at least 20 characters/);
  });

  it('renders pending state with loading CTA copy', () => {
    render(
      <OverrideDialog
        workflowRunId="run-1"
        open={true}
        onOpenChange={noopOpen}
        onSubmit={noopSubmit}
        pending={true}
      />,
    );
    expect(screen.getByRole('button', { name: /Recording override/ })).toBeInTheDocument();
  });

  it('cancel button is wired to attempt close', () => {
    const onOpenChange = vi.fn();
    render(
      <OverrideDialog
        workflowRunId="run-1"
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={noopSubmit}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
