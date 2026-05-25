/**
 * Web-vite split: the legacy `BankStatementDialog` was replaced with a
 * shell + per-step sub-components in `bank-statement-dialog.tsx`. The
 * step variant pick (upload / parsing / results / error) now lives in
 * `BankStatementDialogContainer`. Each sub-component is exercised in
 * isolation here, with stubbed callbacks and shaped fixtures.
 */

import { createRef } from 'react';

import { render, screen, setup } from '@/test/test-utils';

import {
  BankStatementDialogShell,
  BankStatementErrorStep,
  BankStatementParsingStep,
  BankStatementResultsStep,
  BankStatementUploadStep,
} from '../bank-statement-dialog';
import type { BankStatementMatchResult } from '../hooks/use-bank-statement-import.js';

const t = (key: string, vars?: Record<string, unknown>) => {
  if (!vars) return key;
  return `${key}:${JSON.stringify(vars)}`;
};

describe('BankStatementDialogShell', () => {
  it('renders the dialog title when open', () => {
    render(
      <BankStatementDialogShell open onOpenChange={vi.fn()} onCloseAttempt={vi.fn()} t={t}>
        <div>child</div>
      </BankStatementDialogShell>,
    );
    expect(screen.getByText('bankStatement.title')).toBeInTheDocument();
    expect(screen.getByText('child')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(
      <BankStatementDialogShell open={false} onOpenChange={vi.fn()} onCloseAttempt={vi.fn()} t={t}>
        <div>hidden</div>
      </BankStatementDialogShell>,
    );
    expect(screen.queryByText('bankStatement.title')).not.toBeInTheDocument();
  });
});

describe('BankStatementUploadStep', () => {
  it('renders the dropzone copy', () => {
    const ref = createRef<HTMLInputElement>();
    render(<BankStatementUploadStep t={t} fileInputRef={ref} onFileSelect={vi.fn()} />);
    expect(screen.getAllByText('bankStatement.dropzoneText').length).toBeGreaterThan(0);
    expect(screen.getByText('bankStatement.dropzoneFormats')).toBeInTheDocument();
  });

  it('renders a hidden file input that accepts .mt940 and .csv', () => {
    const ref = createRef<HTMLInputElement>();
    render(<BankStatementUploadStep t={t} fileInputRef={ref} onFileSelect={vi.fn()} />);
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
    expect(input?.getAttribute('accept')).toBe('.mt940,.csv');
  });
});

describe('BankStatementParsingStep', () => {
  it('shows the parsing progress copy', () => {
    render(<BankStatementParsingStep t={t} />);
    expect(screen.getByText('bankStatement.parsingProgress')).toBeInTheDocument();
  });
});

describe('BankStatementErrorStep', () => {
  it('shows the parse error message and Try again button', () => {
    render(<BankStatementErrorStep t={t} parseError="Invalid file format" onRetry={vi.fn()} />);
    expect(screen.getByText('Invalid file format')).toBeInTheDocument();
    expect(screen.getByText('bankStatement.tryAgain')).toBeInTheDocument();
  });

  it('invokes onRetry when Try again is clicked', async () => {
    const onRetry = vi.fn();
    const { user } = setup(<BankStatementErrorStep t={t} parseError="oops" onRetry={onRetry} />);
    await user.click(screen.getByText('bankStatement.tryAgain'));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('BankStatementResultsStep', () => {
  const baseMatches: BankStatementMatchResult[] = [
    {
      transactionIndex: 0,
      amountMinor: 100000,
      iban: 'PL12345678901234567890123456',
      matched: true,
      itemId: 'item-1',
      invoiceNumber: 'FV/001',
    },
    {
      transactionIndex: 1,
      amountMinor: 50000,
      iban: 'PL98765432109876543210987654',
      matched: false,
    },
  ];

  function renderResults(overrides: Partial<Parameters<typeof BankStatementResultsStep>[0]> = {}) {
    const onToggleMatch = vi.fn();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    return {
      onToggleMatch,
      onCancel,
      onConfirm,
      ...render(
        <BankStatementResultsStep
          t={t}
          matches={baseMatches}
          selectedMatches={new Set([0])}
          matchedCount={1}
          totalCount={2}
          selectedCount={1}
          onToggleMatch={onToggleMatch}
          onCancel={onCancel}
          onConfirm={onConfirm}
          isConfirmPending={false}
          {...overrides}
        />,
      ),
    };
  }

  it('renders matched and unmatched badges with invoice fallback', () => {
    renderResults();
    expect(screen.getByText('bankStatement.matched')).toBeInTheDocument();
    expect(screen.getByText('bankStatement.unmatched')).toBeInTheDocument();
    expect(screen.getByText('FV/001')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows IBAN last four digits', () => {
    renderResults({
      matches: [
        {
          transactionIndex: 0,
          amountMinor: 10000,
          iban: 'PL12345678901234567890125678',
          matched: false,
        },
      ],
      selectedMatches: new Set(),
      matchedCount: 0,
      totalCount: 1,
      selectedCount: 0,
    });
    expect(screen.getByText('****5678')).toBeInTheDocument();
  });

  it('renders checkboxes only for matched rows', () => {
    renderResults({
      matches: [
        {
          transactionIndex: 0,
          amountMinor: 10000,
          iban: 'PL12345678901234567890125678',
          matched: false,
        },
      ],
      selectedMatches: new Set(),
      matchedCount: 0,
      totalCount: 1,
      selectedCount: 0,
    });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('invokes onToggleMatch with the transaction index when a checkbox is clicked', async () => {
    const onToggleMatch = vi.fn();
    const { user } = setup(
      <BankStatementResultsStep
        t={t}
        matches={[
          {
            transactionIndex: 7,
            amountMinor: 10000,
            iban: 'PL12345678901234567890125678',
            matched: true,
            itemId: 'item-1',
            invoiceNumber: 'FV/001',
          },
        ]}
        selectedMatches={new Set([7])}
        matchedCount={1}
        totalCount={1}
        selectedCount={1}
        onToggleMatch={onToggleMatch}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        isConfirmPending={false}
      />,
    );
    await user.click(screen.getByRole('checkbox'));
    expect(onToggleMatch).toHaveBeenCalledWith(7);
  });

  it('disables the Confirm button when selectedCount is 0', () => {
    renderResults({ selectedCount: 0 });
    const confirmBtn = screen
      .getByText((content: string) => content.startsWith('confirmMatches:'))
      .closest('button');
    expect(confirmBtn).toBeDisabled();
  });

  it('invokes onConfirm when Confirm is clicked', async () => {
    const onConfirm = vi.fn();
    const { user } = setup(
      <BankStatementResultsStep
        t={t}
        matches={baseMatches}
        selectedMatches={new Set([0])}
        matchedCount={1}
        totalCount={2}
        selectedCount={1}
        onToggleMatch={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        isConfirmPending={false}
      />,
    );
    const confirmBtn = screen
      .getByText((content: string) => content.startsWith('confirmMatches:'))
      .closest('button') as HTMLButtonElement;
    await user.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalled();
  });

  it('renders matchedCount label with serialised counts', () => {
    renderResults({ matchedCount: 1, totalCount: 2 });
    const node = screen.getByText((content: string) =>
      content.startsWith('bankStatement.matchedCount:'),
    );
    expect(node.textContent).toContain('"matched":1');
    expect(node.textContent).toContain('"total":2');
  });
});
