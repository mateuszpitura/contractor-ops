import { useTemplateFormSection } from '../hooks/use-template-form-section.js';
import { TemplateForm } from './template-form.js';

interface TemplateFormContainerProps {
  templateId?: string;
}

// Decision: per-action CTA visibility derived from (`isEditing`, `templateStatus`)
// pair returned by `useTemplateFormSection`. Activate/Delete only when DRAFT,
// Archive only when ACTIVE, Duplicate + status badge whenever editing. The
// view is single-render-path per variant — each `show*Cta` flag toggles a
// presentational sibling, the cross-state pick lives here.
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
