"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  MoreHorizontal,
  Pencil,
  FilePlus,
  Upload,
  Ban,
  Replace,
} from "lucide-react";

import { trpc } from "@/trpc/init";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Link } from "@/i18n/navigation";
import { SendForSignatureButton } from "./send-for-signature-button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DetailHeaderProps = {
  contract: {
    id: string;
    title: string | null;
    status: string;
    contractor: {
      id: string;
      legalName: string;
      displayName: string;
      status: string;
    } | null;
    /** Whether the contract has at least one document */
    _documentCount?: number;
    /** Whether at least one e-sign provider is connected */
    _hasConnectedProvider?: boolean;
    /** Parties for signer auto-population */
    _contractParties?: Array<{
      name: string;
      email: string;
      role: "signer" | "countersigner";
    }>;
    /** First document ID for pre-selection */
    _firstDocumentId?: string;
  };
};

// ---------------------------------------------------------------------------
// Status badge styles per UI-SPEC
// ---------------------------------------------------------------------------

const statusBadgeStyles: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground border-border",
  PENDING_SIGNATURE: "bg-amber-500/10 text-amber-600",
  ACTIVE: "bg-green-600/10 text-green-600",
  EXPIRING: "bg-amber-500/10 text-amber-600",
  EXPIRED: "bg-red-500/10 text-red-500",
  TERMINATED: "bg-muted text-muted-foreground border-border",
  SUPERSEDED: "bg-muted/50 text-muted-foreground/60 border-border/50",
  ARCHIVED: "bg-muted text-muted-foreground border-border",
  SIGNATURE_DECLINED: "bg-red-500/10 text-red-500",
  SIGNATURE_EXPIRED: "bg-red-500/10 text-red-500",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_SIGNATURE: "Pending Signature",
  ACTIVE: "Active",
  EXPIRING: "Expiring",
  EXPIRED: "Expired",
  TERMINATED: "Terminated",
  SUPERSEDED: "Superseded",
  ARCHIVED: "Archived",
  SIGNATURE_DECLINED: "Signature Declined",
  SIGNATURE_EXPIRED: "Signature Expired",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DetailHeader({ contract }: DetailHeaderProps) {
  const t = useTranslations("ContractDetail");
  const queryClient = useQueryClient();
  const [terminateOpen, setTerminateOpen] = useState(false);

  const terminateMutation = useMutation(
    trpc.contract.transitionStatus.mutationOptions({
      onSuccess: () => {
        toast.success(t("actions.terminateSuccess"));
        queryClient.invalidateQueries({
          queryKey: trpc.contract.getById.queryKey(),
        });
        setTerminateOpen(false);
      },
      onError: (error: unknown) => {
        const message =
          typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message ?? "")
            : "";
        toast.error(message || t("actions.terminateError"));
      },
    })
  );

  const supersedeMutation = useMutation(
    trpc.contract.transitionStatus.mutationOptions({
      onSuccess: () => {
        toast.success(t("actions.supersedeSuccess"));
        queryClient.invalidateQueries({
          queryKey: trpc.contract.getById.queryKey(),
        });
      },
      onError: (error: unknown) => {
        const message =
          typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message ?? "")
            : "";
        toast.error(message || t("actions.supersedeError"));
      },
    })
  );

  const canTerminate = ["DRAFT", "ACTIVE", "EXPIRING", "EXPIRED", "PENDING_SIGNATURE"].includes(
    contract.status
  );
  const canSupersede = ["ACTIVE", "EXPIRING", "EXPIRED"].includes(
    contract.status
  );

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-[20px] font-semibold leading-tight">
            {contract.title ?? t("untitled")}
          </h1>
          <Badge
            variant="secondary"
            className={statusBadgeStyles[contract.status] ?? ""}
          >
            {statusLabels[contract.status] ?? contract.status}
          </Badge>
        </div>
        {contract.contractor && (
          <div className="mt-1">
            <Link
              href={`/contractors/${contract.contractor.id}`}
              className="text-sm text-primary hover:underline"
            >
              {contract.contractor.displayName}
            </Link>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <SendForSignatureButton
          contractId={contract.id}
          contractStatus={contract.status}
          hasDocument={(contract._documentCount ?? 0) > 0}
          hasConnectedProvider={contract._hasConnectedProvider ?? false}
          documentId={contract._firstDocumentId}
          contractParties={contract._contractParties}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(props) => (
              <Button {...props} variant="outline" size="sm">
                <MoreHorizontal className="mr-1.5 size-3.5" />
                {t("actions.label")}
              </Button>
            )}
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled>
              <Pencil className="mr-2 size-3.5" />
              {t("actions.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <FilePlus className="mr-2 size-3.5" />
              {t("actions.addAmendment")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Upload className="mr-2 size-3.5" />
              {t("actions.uploadDocument")}
            </DropdownMenuItem>

            {(canTerminate || canSupersede) && <DropdownMenuSeparator />}

            {canTerminate && (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setTerminateOpen(true)}
                disabled={terminateMutation.isPending}
              >
                <Ban className="mr-2 size-3.5" />
                {t("actions.terminate")}
              </DropdownMenuItem>
            )}

            {canSupersede && (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() =>
                  supersedeMutation.mutate({
                    id: contract.id,
                    targetStatus: "SUPERSEDED",
                  })
                }
                disabled={supersedeMutation.isPending}
              >
                <Replace className="mr-2 size-3.5" />
                {t("actions.supersede")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Terminate confirmation dialog */}
      <AlertDialog open={terminateOpen} onOpenChange={setTerminateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("actions.terminateTitle", { title: contract.title ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("actions.terminateBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                terminateMutation.mutate({
                  id: contract.id,
                  targetStatus: "TERMINATED",
                })
              }
              disabled={terminateMutation.isPending}
            >
              {t("actions.terminateConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
