"use client";

import type { UseFormReturn } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { trpc } from "@/trpc/init";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { WizardFormValues } from "./wizard-dialog";

interface StepAssignmentProps {
  form: UseFormReturn<WizardFormValues>;
}

/**
 * Step 3: Assignment — owner, team, project, cost center.
 * Owner is required; team, project, and cost center are optional placeholders.
 */
export function StepAssignment({ form }: StepAssignmentProps) {
  const t = useTranslations("ContractorWizard.fields");

  const {
    setValue,
    watch,
    formState: { errors },
  } = form;

  const usersQuery = useQuery(trpc.user.list.queryOptions());
  const users = Array.isArray(usersQuery.data) ? usersQuery.data : [];

  return (
    <div className="space-y-4">
      {/* Owner (required) */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t("owner")}</Label>
        <Select
          value={watch("ownerUserId") ?? ""}
          onValueChange={(value) =>
            setValue("ownerUserId", value ?? "", {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("owner")} />
          </SelectTrigger>
          <SelectContent>
            {(users as Array<{ id?: string; userId?: string; name?: string | null; email?: string | null }>).map(
              (user) => {
                const userId = user.id ?? user.userId ?? "";
                return (
                  <SelectItem key={userId} value={userId}>
                    <div className="flex flex-col">
                      <span>{user.name ?? user.email ?? userId}</span>
                      {user.name && user.email && (
                        <span className="text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                );
              },
            )}
          </SelectContent>
        </Select>
        {errors.ownerUserId && (
          <p className="text-sm text-destructive">
            {errors.ownerUserId.message}
          </p>
        )}
      </div>

      {/* Team (optional, placeholder) */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t("team")}</Label>
        <Select disabled>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("team")} />
          </SelectTrigger>
          <SelectContent>
            {/* Teams not yet queryable */}
          </SelectContent>
        </Select>
      </div>

      {/* Project (optional, placeholder) */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t("project")}</Label>
        <Select disabled>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("project")} />
          </SelectTrigger>
          <SelectContent>
            {/* Projects not yet queryable */}
          </SelectContent>
        </Select>
      </div>

      {/* Cost center (optional, placeholder) */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t("costCenter")}</Label>
        <Select disabled>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("costCenter")} />
          </SelectTrigger>
          <SelectContent>
            {/* Cost centers not yet queryable */}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
