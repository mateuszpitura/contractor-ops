import { Suspense } from 'react';

import { SettingsMembersContainer } from '../../../components/settings/settings-members-container.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';

export default function MembersSettingsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <SettingsMembersContainer />
    </Suspense>
  );
}
