"use client";

import { useState } from "react";
import type { Table } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, UserCheck, Archive, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { trpc } from "@/trpc/init";
import { TemplatePicker } from "@/components/workflows/template-picker-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
// Tooltip imports removed - Launch workflow is no longer disabled
import type { ContractorRow } from "./columns";

interface DataTableBulkActionsProps {
  table: Table<ContractorRow>;
}

/**
 * Bulk action toolbar shown when 1+ rows are selected.
 * Includes assign owner, export CSV/XLSX, archive, and launch workflow.
 */
export function DataTableBulkActions({ table }: DataTableBulkActionsProps) {
  const t = useTranslations("Contractors.bulkActions");
  const ta = useTranslations("Contractors.archive");
  const tc = useTranslations("Contractors");
  const queryClient = useQueryClient();

  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [ownerPopoverOpen, setOwnerPopoverOpen] = useState(false);
  const [workflowPickerOpen, setWorkflowPickerOpen] = useState(false);

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedIds = selectedRows.map((row) => row.original.id);
  const count = selectedIds.length;

  const usersQuery = useQuery(trpc.user.list.queryOptions());
  const users = Array.isArray(usersQuery.data) ? usersQuery.data : [];

  const invalidateAndDeselect = () => {
    queryClient.invalidateQueries({ queryKey: ["contractor"] });
    table.toggleAllPageRowsSelected(false);
  };

  const bulkArchiveMutation = useMutation(
    trpc.contractor.bulkArchive.mutationOptions({
      onSuccess: (data) => {
        toast.success(tc("archived", { count: (data as { count: number }).count }));
        invalidateAndDeselect();
        setShowArchiveDialog(false);
      },
      onError: () => {
        toast.error(tc("error.loadFailed"));
      },
    }),
  );

  const bulkAssignOwnerMutation = useMutation(
    trpc.contractor.bulkAssignOwner.mutationOptions({
      onSuccess: (data) => {
        toast.success(tc("ownerAssigned", { count: (data as { count: number }).count }));
        invalidateAndDeselect();
        setOwnerPopoverOpen(false);
      },
      onError: () => {
        toast.error(tc("error.loadFailed"));
      },
    }),
  );

  const exportMutation = useMutation(
    trpc.contractor.export.mutationOptions({
      onSuccess: (data) => {
        const result = data as {
          data: string;
          filename: string;
          mimeType: string;
        };
        // Decode base64 and trigger download
        const binaryStr = atob(result.data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);

        toast.success(tc("exported", { count }));
        table.toggleAllPageRowsSelected(false);
      },
      onError: () => {
        toast.error(tc("error.loadFailed"));
      },
    }),
  );

  if (count === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
        <span className="text-sm font-medium">
          {t("selected", { count })}
        </span>

        {/* Assign owner */}
        <Popover open={ownerPopoverOpen} onOpenChange={setOwnerPopoverOpen}>
          <PopoverTrigger
            render={(props) => (
              <Button {...props} variant="outline" size="sm" className="h-8 gap-1.5">
                <UserCheck className="h-3.5 w-3.5" />
                {t("assignOwner")}
              </Button>
            )}
          />
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1">
              {(users as Array<{ id?: string; userId?: string; name?: string | null; email?: string | null }>).map(
                (user) => {
                  const userId = user.id ?? user.userId ?? "";
                  return (
                    <button
                      key={userId}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                      onClick={() =>
                        bulkAssignOwnerMutation.mutate({
                          ids: selectedIds,
                          ownerUserId: userId,
                        })
                      }
                      disabled={bulkAssignOwnerMutation.isPending}
                    >
                      <span className="truncate">
                        {user.name ?? user.email ?? userId}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Export */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(props) => (
              <Button {...props} variant="outline" size="sm" className="h-8 gap-1.5">
                {exportMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {t("export")}
              </Button>
            )}
          />
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() =>
                exportMutation.mutate({ ids: selectedIds, format: "csv" })
              }
              disabled={exportMutation.isPending}
            >
              {t("exportCsv")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                exportMutation.mutate({ ids: selectedIds, format: "xlsx" })
              }
              disabled={exportMutation.isPending}
            >
              {t("exportXlsx")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Archive */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-destructive hover:text-destructive"
          onClick={() => setShowArchiveDialog(true)}
        >
          <Archive className="h-3.5 w-3.5" />
          {t("archive")}
        </Button>

        {/* Launch workflow */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => setWorkflowPickerOpen(true)}
        >
          <Zap className="h-3.5 w-3.5" />
          {t("launchWorkflow")}
        </Button>
      </div>

      {/* Workflow template picker */}
      <TemplatePicker
        open={workflowPickerOpen}
        onOpenChange={setWorkflowPickerOpen}
        contractorId={count === 1 ? selectedIds[0] : undefined}
        contractorIds={count > 1 ? selectedIds : undefined}
      />

      {/* Archive confirmation dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ta("titleBulk", { count })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ta("bodyBulk")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                bulkArchiveMutation.mutate({ ids: selectedIds })
              }
              disabled={bulkArchiveMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkArchiveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {ta("ctaBulk", { count })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
