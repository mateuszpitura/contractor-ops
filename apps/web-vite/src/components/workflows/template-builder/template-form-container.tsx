import { useTemplateFormSection } from '../hooks/use-template-form-section.js';
import { TemplateForm } from './template-form.js';

interface TemplateFormContainerProps {
  templateId?: string;
}

export function TemplateFormContainer({ templateId }: TemplateFormContainerProps) {
  const form = useTemplateFormSection(templateId);
  return <TemplateForm {...form} />;
}
