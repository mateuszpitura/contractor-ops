/**
 * Web-vite port of apps/web/src/components/zatca/__tests__/production-certificate.test.tsx.
 *
 * Container splits the step into ProductionCertificateIdle (warning +
 * complete-onboarding action) and ProductionCertificateCompleted (active
 * certificate panel + final Complete). Tests render each sibling
 * directly with live EN translations.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { useTranslations } from '../../../i18n/useTranslations';

import {
  ProductionCertificateCompleted,
  ProductionCertificateIdle,
} from '../production-certificate';

function IdleHarness(props: {
  isPending?: boolean;
  exchangeProductionCert?: () => void;
  onBack?: () => void;
}) {
  const t = useTranslations('Zatca.productionCertificate');
  return (
    <ProductionCertificateIdle
      onBack={props.onBack ?? vi.fn()}
      exchangeProductionCert={props.exchangeProductionCert ?? vi.fn()}
      isPending={props.isPending ?? false}
      t={t}
    />
  );
}

function CompletedHarness(props: { onSuccess?: () => void }) {
  const t = useTranslations('Zatca.productionCertificate');
  return <ProductionCertificateCompleted onSuccess={props.onSuccess ?? vi.fn()} t={t} />;
}

describe('ProductionCertificate (web-vite)', () => {
  it('renders step title', () => {
    render(<IdleHarness />);
    expect(screen.getByText('Step 5 of 5: Activate Production Certificate')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<IdleHarness />);
    expect(screen.getByText(/All compliance checks passed/)).toBeInTheDocument();
  });

  it('renders warning alert about production activation', () => {
    render(<IdleHarness />);
    expect(screen.getByText('Production Activation')).toBeInTheDocument();
    expect(
      screen.getByText(/Once activated, all invoices for Saudi organizations/),
    ).toBeInTheDocument();
  });

  it('renders Complete Onboarding button', () => {
    render(<IdleHarness />);
    expect(screen.getByRole('button', { name: /complete onboarding/i })).toBeInTheDocument();
  });

  it('renders Back button', () => {
    render(<IdleHarness />);
    expect(screen.getByRole('button', { name: /^back$/i })).toBeInTheDocument();
  });

  it('calls onBack when Back is clicked', async () => {
    const onBack = vi.fn();
    const { user } = setup(<IdleHarness onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('disables Complete Onboarding button while pending', () => {
    render(<IdleHarness isPending />);
    expect(screen.getByRole('button', { name: /complete onboarding/i })).toBeDisabled();
  });

  it('invokes exchangeProductionCert when Complete Onboarding is clicked', async () => {
    const exchangeProductionCert = vi.fn();
    const { user } = setup(<IdleHarness exchangeProductionCert={exchangeProductionCert} />);
    await user.click(screen.getByRole('button', { name: /complete onboarding/i }));
    expect(exchangeProductionCert).toHaveBeenCalledOnce();
  });

  it('renders the active certificate panel in completed variant', () => {
    render(<CompletedHarness />);
    expect(screen.getByText('Production Certificate Active')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('shows Complete (final) action in completed variant', () => {
    render(<CompletedHarness />);
    expect(screen.getByRole('button', { name: /^complete$/i })).toBeInTheDocument();
  });

  it('Back button is disabled in completed variant', () => {
    render(<CompletedHarness />);
    expect(screen.getByRole('button', { name: /^back$/i })).toBeDisabled();
  });

  it('invokes onSuccess when the final Complete action is clicked', async () => {
    const onSuccess = vi.fn();
    const { user } = setup(<CompletedHarness onSuccess={onSuccess} />);
    await user.click(screen.getByRole('button', { name: /^complete$/i }));
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
