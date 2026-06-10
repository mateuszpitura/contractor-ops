/**
 * Container now picks one of four sibling components (Skeleton, Disconnected,
 * Onboarding, Connected). Tests render each variant directly so the View
 * file stays pure props-in / JSX-out. The onboarding wizard container is
 * mocked to avoid pulling its full step subtree.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { useTranslations } from '../../../i18n/useTranslations';

vi.mock('../onboarding-wizard.js', () => ({
  OnboardingWizard: () => <div data-testid="onboarding-wizard">Wizard</div>,
}));

import {
  ZatcaStatusCardConnected,
  ZatcaStatusCardDisconnected,
  ZatcaStatusCardOnboarding,
  ZatcaStatusCardSkeleton,
} from '../zatca-status-card';

type ConnectedProps = React.ComponentProps<typeof ZatcaStatusCardConnected>;

function DisconnectedHarness(props: {
  wizardOpen?: boolean;
  openWizard?: () => void;
  closeWizard?: () => void;
  handleWizardComplete?: () => void;
}) {
  const t = useTranslations('Zatca.statusCard');
  return (
    <ZatcaStatusCardDisconnected
      wizardOpen={props.wizardOpen ?? false}
      openWizard={props.openWizard ?? vi.fn()}
      closeWizard={props.closeWizard ?? vi.fn()}
      handleWizardComplete={props.handleWizardComplete ?? vi.fn()}
      t={t}
    />
  );
}

function OnboardingHarness(props: {
  wizardOpen?: boolean;
  openWizard?: () => void;
  closeWizard?: () => void;
  handleWizardComplete?: () => void;
  statusConfig?: ConnectedProps['statusConfig'];
}) {
  const t = useTranslations('Zatca.statusCard');
  return (
    <ZatcaStatusCardOnboarding
      wizardOpen={props.wizardOpen ?? false}
      openWizard={props.openWizard ?? vi.fn()}
      closeWizard={props.closeWizard ?? vi.fn()}
      handleWizardComplete={props.handleWizardComplete ?? vi.fn()}
      statusConfig={props.statusConfig ?? { variant: 'info', labelKey: 'statusLabels.onboarding' }}
      t={t}
    />
  );
}

function ConnectedHarness(props: { statusConfig?: ConnectedProps['statusConfig'] }) {
  const t = useTranslations('Zatca.statusCard');
  return (
    <ZatcaStatusCardConnected
      statusConfig={
        props.statusConfig ?? { variant: 'success', labelKey: 'statusLabels.production' }
      }
      t={t}
    />
  );
}

describe('ZatcaStatusCard (web-vite)', () => {
  it('renders not-connected state with Connect CTA', () => {
    render(<DisconnectedHarness />);
    expect(screen.getByText('ZATCA')).toBeInTheDocument();
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect ZATCA' })).toBeInTheDocument();
  });

  it('opens onboarding wizard when Connect button is clicked', async () => {
    const openWizard = vi.fn();
    const { user } = setup(<DisconnectedHarness openWizard={openWizard} />);
    await user.click(screen.getByRole('button', { name: 'Connect ZATCA' }));
    expect(openWizard).toHaveBeenCalledOnce();
  });

  it('renders the wizard panel when wizardOpen is true (not connected branch)', () => {
    render(<DisconnectedHarness wizardOpen />);
    expect(screen.getByTestId('onboarding-wizard')).toBeInTheDocument();
  });

  it('renders onboarding-in-progress copy and Continue Setup button when onboarding', () => {
    render(<OnboardingHarness />);
    expect(
      screen.getByText('Onboarding in progress — continue the setup wizard.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue setup/i })).toBeInTheDocument();
  });

  it('renders connected production state with Manage and Disconnect buttons', () => {
    render(<ConnectedHarness />);
    expect(screen.getByText('Production')).toBeInTheDocument();
    expect(screen.getByText('Manage')).toBeInTheDocument();
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  });

  it('Manage link points to /settings/integrations/zatca (locale-prefixed)', () => {
    const { container } = render(<ConnectedHarness />);
    const manageLink = Array.from(container.querySelectorAll('a')).find(a =>
      a.textContent?.includes('Manage'),
    );
    expect(manageLink).toBeDefined();
    expect(manageLink?.getAttribute('href')).toContain('/settings/integrations/zatca');
  });

  it('renders loading skeleton sibling', () => {
    const { container } = render(<ZatcaStatusCardSkeleton />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });
});
