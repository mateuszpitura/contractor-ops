"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { trpc } from "@/trpc/init";
import { TemplateForm } from "@/components/workflows/template-builder/template-form";

export default function EditTemplatePage() {
  const params = useParams<{ id: string }>();
  const templateId = params.id;
  const t = useTranslations("Workflows");

  const templateQuery = useQuery(
    trpc.workflow.getTemplate.queryOptions({ id: templateId }),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const template = templateQuery.data as any;

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              render={(props) => <Link {...props} href="/workflows" />}
            >
              {t("pageTitle")}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink
              render={(props) => <Link {...props} href="/workflows" />}
            >
              {t("tabTemplates")}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {template?.name ?? (
                <Skeleton className="inline-block h-4 w-32" />
              )}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <TemplateForm templateId={templateId} />
    </div>
  );
}
