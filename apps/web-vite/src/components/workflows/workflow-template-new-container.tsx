import { useTranslations } from '../../i18n/useTranslations.js';
import { useBreadcrumbOverride } from '../layout/breadcrumb-context.js';
import { TemplateFormContainer } from './template-builder/template-form-container.js';

export function WorkflowTemplateNewContainer() {
  const t = useTranslations('Workflows');
  useBreadcrumbOverride('new', t('newTemplateTitle'));

  return (
    <div className="space-y-6">
      <TemplateFormContainer />
    </div>
  );
}
