/**
 * Container splits the step into ComplianceCsidIdle (action button) and
 * ComplianceCsidProgress (status list) so neither view branches on hook
 * state internally. Tests render each sibling directly through small
 * harnesses that pull live EN translations.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { useTranslations } from '../../../i18n/useTranslations';

import { ComplianceCsidIdle, ComplianceCsidProgress } from '../compliance-csid';

function IdleHarness(props: {
  isPending?: boolean;
  requestComplianceCsid?: () => void;
  onSuccess?: () => void;
  onBack?: () => void;
}) {
  const t = useTranslations('Zatca.complianceCsid');
  return (
    <ComplianceCsidIdle
      onSuccess={props.onSuccess ?? vi.fn()}
      onBack={props.onBack ?? vi.fn()}
      requestComplianceCsid={props.requestComplianceCsid ?? vi.fn()}
      isPending={props.isPending ?? false}
      t={t}
    />
  );
}

function ProgressHarness(props: {
  csidReceived?: boolean;
  certStored?: boolean;
  onSuccess?: () => void;
  onBack?: () => void;
}) {
  const t = useTranslations('Zatca.complianceCsid');
  return (
    <ComplianceCsidProgress
      onSuccess={props.onSuccess ?? vi.fn()}
      onBack={props.onBack ?? vi.fn()}
      csidReceived={props.csidReceived ?? false}
      certStored={props.certStored ?? false}
      t={t}
    />
  );
}

describe('ComplianceCsid (web-vite)', () => {
  it('renders step title', () => {
    render(<IdleHarness />);
    expect(screen.getByText('Step 3 of 5: Request Compliance Certificate')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<IdleHarness />);
    expect(screen.getByText(/Your CSR will be submitted to ZATCA/)).toBeInTheDocument();
  });

  it('renders Request Compliance CSID button in idle state', () => {
    render(<IdleHarness />);
    expect(screen.getByRole('button', { name: /request compliance csid/i })).toBeInTheDocument();
  });

  it('renders Back button', () => {
    render(<IdleHarness />);
    expect(screen.getByRole('button', { name: /^back$/i })).toBeInTheDocument();
  });

  it('renders Next button disabled in idle state', () => {
    render(<IdleHarness />);
    expect(screen.getByRole('button', { name: /^next$/i })).toBeDisabled();
  });

  it('calls onBack when Back is clicked', async () => {
    const onBack = vi.fn();
    const { user } = setup(<IdleHarness onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('invokes requestComplianceCsid when the Request button is clicked', async () => {
    const requestComplianceCsid = vi.fn();
    const { user } = setup(<IdleHarness requestComplianceCsid={requestComplianceCsid} />);
    await user.click(screen.getByRole('button', { name: /request compliance csid/i }));
    expect(requestComplianceCsid).toHaveBeenCalledOnce();
  });

  it('shows spinner inside Request button while pending', () => {
    const { container } = render(<IdleHarness isPending />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows progress list in progress variant', () => {
    render(<ProgressHarness />);
    expect(screen.getByLabelText('Compliance CSID progress')).toBeInTheDocument();
  });

  it('enables Next button once certStored is true', () => {
    render(<ProgressHarness csidReceived certStored />);
    expect(screen.getByRole('button', { name: /^next$/i })).not.toBeDisabled();
  });

  it('invokes onSuccess when Next is clicked after completion', async () => {
    const onSuccess = vi.fn();
    const { user } = setup(<ProgressHarness csidReceived certStored onSuccess={onSuccess} />);
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
