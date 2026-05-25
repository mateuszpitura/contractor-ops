import { useTranslations } from '../../i18n/useTranslations.js';
import { BillingPastDueBanner } from './billing-overlay.js';
import { useBillingOverlay } from './hooks/use-billing-overlay.js';
import { SoftBlockModal } from './soft-block-modal.js';
import { TrialBanner } from './trial-banner.js';

export function BillingOverlayContainer() {
  const t = useTranslations('Billing.overlay');
  const overlay = useBillingOverlay();

  if (!overlay.subscription) return null;

  const showSoftBlock = overlay.isTrialExpired || overlay.isBlocked;

  return (
    <>
      {overlay.showTrialBanner && overlay.trialEnd ? (
        <TrialBanner trialEnd={overlay.trialEnd} onUpgrade={overlay.handleUpgrade} />
      ) : null}
      {overlay.isPastDue ? (
        <BillingPastDueBanner
          onResolve={overlay.handleUpgrade}
          labels={{
            paymentFailed: t('paymentFailed'),
            paymentFailedBody: t('paymentFailedBody'),
            goToBilling: t('goToBilling'),
          }}
        />
      ) : null}
      {showSoftBlock ? (
        <SoftBlockModal
          isOpen
          onSelectPlan={overlay.handleSelectPlan}
          isSelecting={overlay.isSelecting}
        />
      ) : null}
    </>
  );
}
