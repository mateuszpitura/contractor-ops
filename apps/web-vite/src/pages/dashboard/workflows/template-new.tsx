import { Suspense } from 'react';

import { TemplateFormSection } from '../../../components/workflows/template-builder/template-form.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useBreadcrumbOverride } from '../../../components/layout/breadcrumb-context.js';

function WorkflowTemplateNewPageContent() {
  const t = useTranslations('Workflows');
  useBreadcrumbOverride('new', t('newTemplateTitle'));

  return (
    <div className="space-y-6">
      <TemplateFormSection />
    </div>
  );
}

export default function WorkflowTemplateNewPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <WorkflowTemplateNewPageContent />
    </Suspense>
  );
}
