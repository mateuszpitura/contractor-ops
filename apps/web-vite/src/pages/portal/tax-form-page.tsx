/**
 * Portal tax-form route — thin composer. Renders the self-certification wizard
 * inside a Suspense boundary. All data access and section states live in the
 * wizard container + hook (page→container→hook→component layering).
 */

import { Suspense } from 'react';

import { TaxFormWizard } from '../../components/portal/tax-forms/tax-form-wizard.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function PortalTaxFormPage() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-section-gap py-8">
      <Suspense fallback={<PageLoadingSpinner />}>
        <TaxFormWizard />
      </Suspense>
    </div>
  );
}
