import { useCallback, useEffect, useState } from 'react';

import { hasCookieConsent, recordCookieConsent } from '../../../lib/consent.js';
import { initPostHog } from '../../../lib/posthog.js';

export interface CookieConsentView {
  visible: boolean;
  handleAccept: () => void;
}

export function useCookieConsent(): CookieConsentView {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasCookieConsent()) {
      setVisible(true);
    }
  }, []);

  const handleAccept = useCallback(() => {
    recordCookieConsent();
    // Fire any consent-gated SDK init now that the user has opted in.
    // PostHog's `initPostHog()` early-returns until this point.
    initPostHog();
    setVisible(false);
  }, []);

  return { visible, handleAccept };
}
