import { useTemplateFormSection } from '../hooks/use-template-form-section.js';
import { TemplateForm } from './template-form.js';

interface TemplateFormContainerProps {
  templateId?: string;
}

export function TemplateFormContainer({ templateId }: TemplateFormContainerProps) {
  const form = useTemplateFormSection(templateId);
  const showActivateCta = form.isEditing && form.templateStatus === 'DRAFT';
  const showArchiveCta = form.isEditing && form.templateStatus === 'ACTIVE';
  const showDuplicateCta = form.isEditing;
  const showDeleteCta = form.isEditing && form.templateStatus === 'DRAFT';
  const showStatusBadge = form.isEditing;
  return (
    <TemplateForm
      {...form}
      showActivateCta={showActivateCta}
      showArchiveCta={showArchiveCta}
      showDuplicateCta={showDuplicateCta}
      showDeleteCta={showDeleteCta}
      showStatusBadge={showStatusBadge}
    />
  );
}
