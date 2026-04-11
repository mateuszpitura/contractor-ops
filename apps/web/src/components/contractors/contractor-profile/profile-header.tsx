"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { MoreHorizontal, Pencil, FilePlus, Play } from "lucide-react";

import { trpc } from "@/trpc/init";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getAvatarInitials } from "@/lib/avatar-initials";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ContractWizardDialog } from "@/components/contracts/contract-wizard/wizard-dialog";
import { TemplatePicker } from "@/components/workflows/template-picker-dialog";

type LifecycleStage =
  | "DRAFT"
  | "ONBOARDING"
  | "ACTIVE"
  | "OFFBOARDING"
  | "ENDED";

type ProfileHeaderProps = {
  contractor: {
    id: string;
    displayName: string;
    legalName: string;
    type: string;
    lifecycleStage: string;
    owner: { id: string; name: string | null; image: string | null } | null;
  };
};

const lifecycleBadgeStyles: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground border-border",
  ONBOARDING: "bg-blue-500/10 text-blue-500",
  ACTIVE: "bg-green-600/10 text-green-600",
  OFFBOARDING: "bg-amber-500/10 text-amber-600",
  ENDED: "bg-muted text-muted-foreground border-border",
};

// Lifecycle labels are now served from translations: ContractorProfile.lifecycle.*

export function ProfileHeader({ contractor }: ProfileHeaderProps) {
  const t = useTranslations("ContractorProfile");
  const tc = useTranslations("Contractors");
  const tToast = useTranslations("ContractorProfile.toast");
  const tCommon = useTranslations("Common");
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<string | undefined>(undefined);

  const lifecycleMutation = useMutation(
    trpc.contractor.updateLifecycleStage.mutationOptions({
      onSuccess: (_data, variables) => {
        toast.success(
          t("lifecycle.transitioned", { stage: variables.stage })
        );
        queryClient.invalidateQueries({
          queryKey: trpc.contractor.getById.queryKey(),
        });
      },
      onError: (error: unknown) => {
        const message =
          typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message ?? "")
            : "";
        toast.error(message || tToast("statusFailed"));
      },
    })
  );

  const archiveMutation = useMutation(
    trpc.contractor.archive.mutationOptions({
      onSuccess: () => {
        toast.success(t("lifecycle.archived"));
        queryClient.invalidateQueries({
          queryKey: trpc.contractor.getById.queryKey(),
        });
      },
      onError: (error: unknown) => {
        const message =
          typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message ?? "")
            : "";
        toast.error(message || tToast("archiveFailed"));
      },
    })
  );

  const stage = contractor.lifecycleStage as LifecycleStage;
  const isPending = lifecycleMutation.isPending || archiveMutation.isPending;

  function handleLifecycleAction(targetStage: LifecycleStage) {
    lifecycleMutation.mutate({ id: contractor.id, stage: targetStage });
  }

  function handleArchive() {
    archiveMutation.mutate({ id: contractor.id });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-semibold leading-tight">
              {contractor.displayName}
            </h1>
            <Badge
              variant="secondary"
              className={lifecycleBadgeStyles[stage] ?? ""}
            >
              {t(`lifecycle.${stage}` as Parameters<typeof t>[0]) ?? stage}
            </Badge>
            <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
              {tc(`type.${contractor.type}` as Parameters<typeof tc>[0])}
            </Badge>
          </div>
          {contractor.owner && (
            <div className="mt-1 flex items-center gap-1.5">
              <Avatar size="sm">
                {contractor.owner.image && (
                  <AvatarImage src={contractor.owner.image} alt={contractor.owner.name ?? ""} />
                )}
                <AvatarFallback>
                  {getAvatarInitials(contractor.owner.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">
                {contractor.owner.name ?? t("unknown")}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast.info(t("actions.editComingSoon"))}
        >
          <Pencil className="me-1.5 size-3.5" />
          {t("actions.edit")}
        </Button>

        <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)}>
          <FilePlus className="me-1.5 size-3.5" />
          {t("actions.addContract")}
        </Button>

        {(stage === "DRAFT" || stage === "ONBOARDING") && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPickerType("ONBOARDING");
              setPickerOpen(true);
            }}
          >
            <Play className="me-1.5 size-3.5" />
            {t("actions.startOnboarding")}
          </Button>
        )}

        {(stage === "ACTIVE" || stage === "OFFBOARDING") && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPickerType("OFFBOARDING");
              setPickerOpen(true);
            }}
          >
            <Play className="me-1.5 size-3.5" />
            {t("actions.startOffboarding")}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={(props) => (
              <Button {...props} variant="outline" size="icon-sm">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">{tCommon("srOnly.moreActions")}</span>
              </Button>
            )}
          />
          <DropdownMenuContent align="end">
            {stage === "DRAFT" && (
              <DropdownMenuItem
                disabled={isPending}
                onSelect={() => handleLifecycleAction("ONBOARDING")}
              >
                {t("actions.startOnboarding")}
              </DropdownMenuItem>
            )}
            {stage === "ONBOARDING" && (
              <DropdownMenuItem
                disabled={isPending}
                onSelect={() => handleLifecycleAction("ACTIVE")}
              >
                {t("actions.activate")}
              </DropdownMenuItem>
            )}
            {stage === "ACTIVE" && (
              <>
                <DropdownMenuItem
                  disabled={isPending}
                  onSelect={() => handleLifecycleAction("OFFBOARDING")}
                >
                  {t("actions.startOffboarding")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isPending}
                  onSelect={() => handleLifecycleAction("ENDED")}
                >
                  {t("actions.markInactive")}
                </DropdownMenuItem>
              </>
            )}
            {stage === "OFFBOARDING" && (
              <DropdownMenuItem
                disabled={isPending}
                onSelect={() => handleLifecycleAction("ENDED")}
              >
                {t("actions.completeOffboarding")}
              </DropdownMenuItem>
            )}
            {stage === "ENDED" && (
              <DropdownMenuItem
                disabled={isPending}
                variant="destructive"
                onSelect={handleArchive}
              >
                {t("actions.archive")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Contract wizard dialog */}
      <ContractWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        contractorId={contractor.id}
      />

      {/* Workflow template picker */}
      <TemplatePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        contractorId={contractor.id}
        preFilterType={pickerType}
      />
    </div>
  );
}
