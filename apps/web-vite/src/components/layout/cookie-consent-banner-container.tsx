import { CookieConsentBanner } from './cookie-consent-banner.js';
import { useCookieConsent } from './hooks/use-cookie-consent.js';

export function CookieConsentBannerContainer() {
  const { visible, handleAccept } = useCookieConsent();
  if (!visible) return null;
  return <CookieConsentBanner onAccept={handleAccept} />;
}
