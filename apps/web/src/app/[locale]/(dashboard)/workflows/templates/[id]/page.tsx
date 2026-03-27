"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { useBreadcrumbOverride } from "@/components/layout/breadcrumb-context";
import { trpc } from "@/trpc/init";
import { TemplateForm } from "@/components/workflows/template-builder/template-form";

export default function EditTemplatePage() {
  const params = useParams<{ id: string }>();
  const templateId = params.id;

  const templateQuery = useQuery(
    trpc.workflow.getTemplate.queryOptions({ id: templateId }),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const template = templateQuery.data as any;

  useBreadcrumbOverride(templateId, template?.name);

  return (
    <div className="space-y-6">
      <TemplateForm templateId={templateId} />
    </div>
  );
}
