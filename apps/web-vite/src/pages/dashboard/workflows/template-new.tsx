import { Suspense } from 'react';
import { useBreadcrumbOverride } from '../../../components/layout/breadcrumb-context.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';
import { TemplateFormSection } from '../../../components/workflows/template-builder/template-form.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

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
