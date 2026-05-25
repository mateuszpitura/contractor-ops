import { useTranslations } from '../../i18n/useTranslations.js';
import { useBreadcrumbOverride } from '../layout/breadcrumb-context.js';
import { TemplateFormContainer } from './template-builder/template-form-container.js';

/**
 * Decisive container — owns the "new template" route side-effect: registers
 * the breadcrumb override for the `/new` segment via `useBreadcrumbOverride`.
 * Per ARCHITECTURE.md "Container responsibility" rule #6 this earns a file
 * because it performs side-effect setup (breadcrumb context registration).
 */
export function WorkflowTemplateNewContainer() {
  const t = useTranslations('Workflows');
  useBreadcrumbOverride('new', t('newTemplateTitle'));

  return (
    <div className="space-y-6">
      <TemplateFormContainer />
    </div>
  );
}
