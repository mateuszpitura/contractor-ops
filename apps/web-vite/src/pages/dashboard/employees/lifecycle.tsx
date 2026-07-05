/**
 * Employee on/offboarding lifecycle — thin page shell.
 *
 * Gated by `module.workforce-employees`; the flag gate lives here, all data
 * access in the container's hook. Auth gating lives on the shell parent in the
 * dashboard route table. Surfaces the HR on/offboarding actions, draft statutory
 * cert generation, the dated-termination record, and the worker-keyed IdP
 * deprovisioning trigger (actionable only once a termination date is recorded).
 */

import { Suspense } from 'react';
import { useParams } from 'react-router-dom';

import { EmployeeLifecycleContainer } from '../../../components/employees/employee-lifecycle-container.js';
import { useFlag } from '../../../components/layout/feature-flag-context.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';

export default function EmployeeLifecyclePage() {
  const { workerId } = useParams();
  const workforceEnabled = useFlag('module.workforce-employees');

  if (!(workforceEnabled && workerId)) return null;

  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <EmployeeLifecycleContainer workerId={workerId} />
    </Suspense>
  );
}
