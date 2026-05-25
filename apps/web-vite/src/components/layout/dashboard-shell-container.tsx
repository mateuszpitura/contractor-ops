import { useTranslations } from '../../i18n/useTranslations.js';
import { TOS_CURRENT_VERSION } from '../../lib/tos.js';
import { PageLoadingSpinner } from '../shared/page-loading-spinner.js';
import { TosReacceptanceModalContainer } from '../tos-reacceptance-modal-container.js';
import { DashboardShell } from './dashboard-shell.js';
import { useDashboardShell } from './hooks/use-dashboard-shell.js';
import { useFlagBagValues } from './hooks/use-flag-bag.js';

export function DashboardShellContainer() {
  const tLayout = useTranslations('Layout');
  const { isLoading, activeOrg, memberRole, activeOrgId, session, needsTosAcceptance } =
    useDashboardShell();
  const flagBag = useFlagBagValues(activeOrgId, session.isPending);

  if (isLoading) {
    return <PageLoadingSpinner />;
  }

  return (
    <>
      {needsTosAcceptance ? (
        <TosReacceptanceModalContainer currentVersion={TOS_CURRENT_VERSION} />
      ) : null}
      <DashboardShell
        skipToContentLabel={tLayout('skipToContent')}
        activeOrg={activeOrg}
        memberRole={memberRole}
        flagBag={flagBag}
      />
    </>
  );
}
