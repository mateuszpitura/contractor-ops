"use client";

import { useTranslations } from "next-intl";

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Link } from "@/i18n/navigation";
import { TemplateForm } from "@/components/workflows/template-builder/template-form";

export default function NewTemplatePage() {
  const t = useTranslations("Workflows");

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
            <BreadcrumbPage>{t("newTemplateTitle")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <TemplateForm />
    </div>
  );
}
