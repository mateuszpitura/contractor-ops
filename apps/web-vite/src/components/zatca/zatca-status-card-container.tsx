import { useZatcaStatusCard } from './hooks/use-zatca-status-card.js';
import {
  ZatcaStatusCardConnected,
  ZatcaStatusCardDisconnected,
  ZatcaStatusCardOnboarding,
  ZatcaStatusCardSkeleton,
} from './zatca-status-card.js';

export function ZatcaStatusCard() {
  const {
    isLoading,
    wizardOpen,
    openWizard,
    closeWizard,
    isConnected,
    isOnboarding,
    statusConfig,
    handleWizardComplete,
    t,
  } = useZatcaStatusCard();

  if (isLoading) return <ZatcaStatusCardSkeleton />;

  if (isConnected) return <ZatcaStatusCardConnected statusConfig={statusConfig} t={t} />;

  if (isOnboarding) {
    return (
      <ZatcaStatusCardOnboarding
        wizardOpen={wizardOpen}
        openWizard={openWizard}
        closeWizard={closeWizard}
        handleWizardComplete={handleWizardComplete}
        statusConfig={statusConfig}
        t={t}
      />
    );
  }

  return (
    <ZatcaStatusCardDisconnected
      wizardOpen={wizardOpen}
      openWizard={openWizard}
      closeWizard={closeWizard}
      handleWizardComplete={handleWizardComplete}
      t={t}
    />
  );
}
