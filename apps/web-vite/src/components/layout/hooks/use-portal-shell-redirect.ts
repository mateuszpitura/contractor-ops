import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { localePath, useLocale } from '../../../i18n/navigation.js';

export function usePortalShellRedirect(shouldRedirectToLogin: boolean): void {
  const navigate = useNavigate();
  const locale = useLocale();

  useEffect(() => {
    if (shouldRedirectToLogin) {
      void navigate(localePath('/portal/login', locale), { replace: true });
    }
  }, [shouldRedirectToLogin, navigate, locale]);
}
