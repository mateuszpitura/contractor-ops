import { useTranslations } from '../../i18n/useTranslations.js';
import { usePortalShell } from './hooks/use-portal-shell.js';
import { usePortalShellRedirect } from './hooks/use-portal-shell-redirect.js';
import { PortalShell } from './portal-shell.js';
import { PortalShellSkeleton } from './portal-shell-skeleton.js';

export function PortalShellContainer() {
  const tLayout = useTranslations('Layout');
  const { isLoading, shouldRedirectToLogin, shellStyle, topBarProps } = usePortalShell();

  usePortalShellRedirect(shouldRedirectToLogin);

  if (isLoading) {
    return <PortalShellSkeleton />;
  }
  if (!topBarProps) {
    return null;
  }

  return (
    <PortalShell
      skipToContentLabel={tLayout('skipToContent')}
      isLoading={false}
      shellStyle={shellStyle}
      topBarProps={topBarProps}
    />
  );
}
