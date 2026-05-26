import { Suspense } from 'react';

import { SettingsWorkflowRolesContainer } from '../../../components/settings/settings-workflow-roles-container.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';

export default function WorkflowRolesSettingsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <SettingsWorkflowRolesContainer />
    </Suspense>
  );
}
