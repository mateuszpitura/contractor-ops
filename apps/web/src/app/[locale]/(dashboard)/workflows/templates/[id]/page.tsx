'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';

import { useBreadcrumbOverride } from '@/components/layout/breadcrumb-context';
import { TemplateForm } from '@/components/workflows/template-builder/template-form';
import { trpc } from '@/trpc/init';

export default function EditTemplatePage() {
  const params = useParams<{ id: string }>();
  const templateId = params.id;

  const templateQuery = useQuery(trpc.workflow.getTemplate.queryOptions({ id: templateId }));

  const template = templateQuery.data;

  useBreadcrumbOverride(templateId, template?.name);

  return (
    <div className="space-y-6">
      <TemplateForm templateId={templateId} />
    </div>
  );
}
