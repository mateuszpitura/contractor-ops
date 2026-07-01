/**
 * Staff personnel-file (akta osobowe) detail route — thin page shell.
 *
 * Reached only when `module.workforce-employees` is enabled; the flag gate and
 * all data access live in the wired view. Auth gating lives on the shell parent
 * in router.tsx.
 */

import { Suspense } from 'react';

import { PersonnelFileView } from '../../../components/employees/personnel-file/personnel-file-shell.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';

export default function PersonnelFilePage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PersonnelFileView />
    </Suspense>
  );
}
