"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { MoreHorizontal, Pencil, FilePlus, Upload } from "lucide-react";

import { trpc } from "@/trpc/init";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

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

const lifecycleLabels: Record<string, string> = {
  DRAFT: "Draft",
  ONBOARDING: "Onboarding",
  ACTIVE: "Active",
  OFFBOARDING: "Offboarding",
  ENDED: "Ended",
};

function getOwnerInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ProfileHeader({ contractor }: ProfileHeaderProps) {
  const t = useTranslations("ContractorProfile");
  const queryClient = useQueryClient();

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
        toast.error(message || "Failed to update status");
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
        toast.error(message || "Failed to archive contractor");
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
              {lifecycleLabels[stage] ?? stage}
            </Badge>
            <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
              {contractor.type}
            </Badge>
          </div>
          {contractor.owner && (
            <div className="mt-1 flex items-center gap-1.5">
              <Avatar size="sm">
                {contractor.owner.image && (
                  <AvatarImage src={contractor.owner.image} alt={contractor.owner.name ?? ""} />
                )}
                <AvatarFallback>
                  {getOwnerInitials(contractor.owner.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">
                {contractor.owner.name ?? "Unknown"}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm">
          <Pencil className="mr-1.5 size-3.5" />
          {t("actions.edit")}
        </Button>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={(props) => (
                <Button {...props} variant="outline" size="sm" disabled>
                  <FilePlus className="mr-1.5 size-3.5" />
                  {t("actions.addContract")}
                </Button>
              )}
            />
            <TooltipContent>Coming in Phase 3</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={(props) => (
              <Button {...props} variant="outline" size="icon-sm">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">More actions</span>
              </Button>
            )}
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled>
              <Upload className="mr-2 size-3.5" />
              {t("actions.uploadInvoice")}
              <span className="ml-auto text-xs text-muted-foreground">
                Phase 5
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />

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
    </div>
  );
}
