/**
 * Web-vite port of apps/web/src/components/zatca/__tests__/compliance-checks.test.tsx.
 *
 * Container splits the step into ComplianceChecksIdle (Run button) and
 * ComplianceChecksResults (per-row status + progress). Tests render
 * each sibling directly with live EN translations.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { useTranslations } from '../../../i18n/useTranslations';

import { ComplianceChecksIdle, ComplianceChecksResults } from '../compliance-checks';

type ResultsProps = React.ComponentProps<typeof ComplianceChecksResults>;

function IdleHarness(props: {
  isPending?: boolean;
  runChecks?: () => void;
  onSuccess?: () => void;
  onBack?: () => void;
}) {
  const t = useTranslations('Zatca.complianceChecks');
  return (
    <ComplianceChecksIdle
      onSuccess={props.onSuccess ?? vi.fn()}
      onBack={props.onBack ?? vi.fn()}
      runChecks={props.runChecks ?? vi.fn()}
      isPending={props.isPending ?? false}
      t={t}
    />
  );
}

function ResultsHarness(props: {
  results?: ResultsProps['results'];
  isPending?: boolean;
  allPassed?: boolean;
  completedCount?: number;
  progressValue?: number;
  onSuccess?: () => void;
  onBack?: () => void;
}) {
  const t = useTranslations('Zatca.complianceChecks');
  const testLabels = [
    t('testLabels.standardTaxInvoice'),
    t('testLabels.standardCreditNote'),
    t('testLabels.standardDebitNote'),
    t('testLabels.simplifiedInvoice'),
    t('testLabels.simplifiedCreditNote'),
    t('testLabels.simplifiedDebitNote'),
  ];
  return (
    <ComplianceChecksResults
      onSuccess={props.onSuccess ?? vi.fn()}
      onBack={props.onBack ?? vi.fn()}
      results={props.results ?? []}
      isPending={props.isPending ?? false}
      allPassed={props.allPassed ?? false}
      completedCount={props.completedCount ?? 0}
      progressValue={props.progressValue ?? 0}
      testLabels={testLabels}
      t={t}
    />
  );
}

describe('ComplianceChecks (web-vite)', () => {
  it('renders step title', () => {
    render(<IdleHarness />);
    expect(screen.getByText('Step 4 of 5: Run Compliance Checks')).toBeInTheDocument();
  });

  it('renders Run Compliance Checks button initially', () => {
    render(<IdleHarness />);
    expect(screen.getByRole('button', { name: /run compliance checks/i })).toBeInTheDocument();
  });

  it('renders Back and Next buttons', () => {
    render(<IdleHarness />);
    expect(screen.getByRole('button', { name: /^back$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^next$/i })).toBeInTheDocument();
  });

  it('renders Next button disabled in idle variant', () => {
    render(<IdleHarness />);
    expect(screen.getByRole('button', { name: /^next$/i })).toBeDisabled();
  });

  it('calls onBack when Back is clicked', async () => {
    const onBack = vi.fn();
    const { user } = setup(<IdleHarness onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('disables Run button while pending', () => {
    render(<IdleHarness isPending />);
    expect(screen.getByRole('button', { name: /run compliance checks/i })).toBeDisabled();
  });

  it('invokes runChecks when Run button is clicked', async () => {
    const runChecks = vi.fn();
    const { user } = setup(<IdleHarness runChecks={runChecks} />);
    await user.click(screen.getByRole('button', { name: /run compliance checks/i }));
    expect(runChecks).toHaveBeenCalledOnce();
  });

  it('enables Next button when allPassed is true', () => {
    render(
      <ResultsHarness
        results={
          Array.from({ length: 6 }, (_, i) => ({
            status: 'CLEARED',
            // biome-ignore lint/style/useTemplate: simple concat
            invoiceType: 'standardTax' + i,
          })) as unknown as ResultsProps['results']
        }
        allPassed
        completedCount={6}
        progressValue={100}
      />,
    );
    expect(screen.getByRole('button', { name: /^next$/i })).not.toBeDisabled();
  });

  it('renders results list when results are present', () => {
    render(
      <ResultsHarness
        results={
          [
            { status: 'CLEARED' },
            { status: 'CLEARED' },
            { status: 'CLEARED' },
            { status: 'REPORTED' },
            { status: 'REPORTED' },
            { status: 'REPORTED' },
          ] as ResultsProps['results']
        }
        allPassed
        completedCount={6}
        progressValue={100}
      />,
    );
    expect(screen.getByLabelText('Compliance check results')).toBeInTheDocument();
  });
});
