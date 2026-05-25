/**
 * Web-vite port of apps/web/src/components/zatca/__tests__/compliance-checks.test.tsx.
 *
 * ComplianceChecksView is a pure presentational component split from the
 * `useComplianceChecks` hook. The test mounts a tiny container that pulls
 * the real `Zatca.complianceChecks` translations via `useTranslations` so
 * the rendered text matches the live EN bundle without re-stubbing keys.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { useTranslations } from '../../../i18n/useTranslations';

import { ComplianceChecksView } from '../compliance-checks';

type ViewProps = React.ComponentProps<typeof ComplianceChecksView>;

interface Overrides {
  results?: ViewProps['results'];
  isPending?: boolean;
  allPassed?: boolean;
  completedCount?: number;
  progressValue?: number;
  runChecks?: () => void;
  onSuccess?: () => void;
  onBack?: () => void;
}

function Harness(props: Overrides) {
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
    <ComplianceChecksView
      onSuccess={props.onSuccess ?? vi.fn()}
      onBack={props.onBack ?? vi.fn()}
      results={props.results ?? []}
      runChecks={props.runChecks ?? vi.fn()}
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
    render(<Harness />);
    expect(screen.getByText('Step 4 of 5: Run Compliance Checks')).toBeInTheDocument();
  });

  it('renders Run Compliance Checks button initially', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: /run compliance checks/i })).toBeInTheDocument();
  });

  it('renders Back and Next buttons', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: /^back$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^next$/i })).toBeInTheDocument();
  });

  it('renders Next button disabled before checks pass', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: /^next$/i })).toBeDisabled();
  });

  it('calls onBack when Back is clicked', async () => {
    const onBack = vi.fn();
    const { user } = setup(<Harness onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('disables Run button while pending', () => {
    render(<Harness isPending />);
    expect(screen.getByRole('button', { name: /run compliance checks/i })).toBeDisabled();
  });

  it('invokes runChecks when Run button is clicked', async () => {
    const runChecks = vi.fn();
    const { user } = setup(<Harness runChecks={runChecks} />);
    await user.click(screen.getByRole('button', { name: /run compliance checks/i }));
    expect(runChecks).toHaveBeenCalledOnce();
  });

  it('enables Next button when allPassed is true', () => {
    render(
      <Harness
        results={
          Array.from({ length: 6 }, (_, i) => ({
            status: 'CLEARED',
            // biome-ignore lint/style/useTemplate: simple concat
            invoiceType: 'standardTax' + i,
          })) as unknown as ViewProps['results']
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
      <Harness
        results={
          [
            { status: 'CLEARED' },
            { status: 'CLEARED' },
            { status: 'CLEARED' },
            { status: 'REPORTED' },
            { status: 'REPORTED' },
            { status: 'REPORTED' },
          ] as ViewProps['results']
        }
        allPassed
        completedCount={6}
        progressValue={100}
      />,
    );
    expect(screen.getByLabelText('Compliance check results')).toBeInTheDocument();
  });
});
