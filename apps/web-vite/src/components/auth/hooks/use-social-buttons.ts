/**
 * Social-buttons domain hook — drives OAuth sign-in for Google + Microsoft.
 *
 * Owns auth-client mutation, per-provider loading state, and Sentry capture
 * so the matching `<SocialButtons />` stays presentational.
 */

import { useCallback, useState } from 'react';

import { useAuth } from '../../../providers/auth-provider.js';
import { Sentry } from '../../../sentry.js';

export type SocialProvider = 'google' | 'microsoft';

export interface SocialButtonsProps {
  loadingProvider: SocialProvider | null;
  disabled: boolean;
  onGoogleLogin: () => void;
  onMicrosoftLogin: () => void;
}

export function useSocialButtons(): SocialButtonsProps {
  const auth = useAuth();
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null);

  const handleSocialLogin = useCallback(
    async (provider: SocialProvider) => {
      setLoadingProvider(provider);
      try {
        await auth.signIn.social({ provider, callbackURL: '/' });
      } catch (err) {
        // F-OBS-13 — capture so OAuth-redirect failures surface in Sentry
        // instead of leaving the user with a frozen button.
        Sentry.captureException(err, {
          tags: { 'auth.flow': 'social', 'auth.provider': provider },
        });
        setLoadingProvider(null);
      }
    },
    [auth],
  );

  const onGoogleLogin = useCallback(() => {
    void handleSocialLogin('google');
  }, [handleSocialLogin]);

  const onMicrosoftLogin = useCallback(() => {
    void handleSocialLogin('microsoft');
  }, [handleSocialLogin]);

  return {
    loadingProvider,
    disabled: loadingProvider !== null,
    onGoogleLogin,
    onMicrosoftLogin,
  };
}
