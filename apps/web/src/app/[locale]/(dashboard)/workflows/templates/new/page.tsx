'use client';

import { useTranslations } from 'next-intl';

import { useBreadcrumbOverride } from '@/components/layout/breadcrumb-context';
import { TemplateForm } from '@/components/workflows/template-builder/template-form';

export default function NewTemplatePage() {
  const t = useTranslations('Workflows');

  useBreadcrumbOverride('new', t('newTemplateTitle'));

  return (
    <div className="space-y-6">
      <TemplateForm />
    </div>
  );
}
