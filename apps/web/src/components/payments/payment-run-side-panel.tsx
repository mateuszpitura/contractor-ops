"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Download,
  CheckCircle2,
  FileUp,
  XCircle,
  MoreHorizontal,
  Trash2,
} from "lucide-react";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";

import { PaymentRunBadge, PaymentItemBadge } from "./payment-run-badge";

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatGrosze(grosze: number, currency?: string | null): string {
  const formatted = new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(grosze / 100);
  return currency ? `${formatted} ${currency}` : formatted;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 1) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString("pl-PL");
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PaymentRunSidePanelProps {
  runId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportStatement?: (runId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PaymentRunSidePanel({
  runId,
  open,
  onOpenChange,
  onImportStatement,
}: PaymentRunSidePanelProps) {
  const t = useTranslations("Payments");
  const queryClient = useQueryClient();

  // Fetch run data
  const runQuery = useQuery({
    ...trpc.payment.get.queryOptions({ runId: runId! }),
    enabled: !!runId && open,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const run = runQuery.data as any;

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const invalidateQueries = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: [["payment", "get"]],
    });
    void queryClient.invalidateQueries({
      queryKey: [["payment", "list"]],
    });
  }, [queryClient]);

  const markAllPaidMutation = useMutation(
    trpc.payment.markAllPaid.mutationOptions({
      onSuccess: () => {
        toast.success(t("toast.allMarkedPaid"));
        invalidateQueries();
      },
      onError: () => {
        toast.error(t("errors.failedToMarkPaid"));
      },
    }),
  );

  const cancelMutation = useMutation(
    trpc.payment.cancel.mutationOptions({
      onSuccess: () => {
        toast.success(t("toast.runCancelled"));
        invalidateQueries();
        onOpenChange(false);
      },
      onError: () => {
        toast.error(t("errors.failedToCancel"));
      },
    }),
  );

  const updateItemStatusMutation = useMutation(
    trpc.payment.updateItemStatus.mutationOptions({
      onSuccess: () => {
        toast.success(t("toast.itemUpdated"));
        invalidateQueries();
      },
      onError: () => {
        toast.error(t("errors.failedToUpdateItem"));
      },
    }),
  );

  const removeFromRunMutation = useMutation(
    trpc.payment.removeFromRun.mutationOptions({
      onSuccess: () => {
        toast.success(t("toast.removedFromRun"));
        invalidateQueries();
      },
      onError: () => {
        toast.error(t("errors.failedToRemove"));
      },
    }),
  );

  // ---------------------------------------------------------------------------
  // Mark all paid confirmation state
  // ---------------------------------------------------------------------------

  const [confirmMarkAll, setConfirmMarkAll] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleMarkAllPaid = useCallback(() => {
    if (!confirmMarkAll) {
      setConfirmMarkAll(true);
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => {
        setConfirmMarkAll(false);
      }, 3000);
      return;
    }
    if (runId) {
      markAllPaidMutation.mutate({ runId });
      setConfirmMarkAll(false);
    }
  }, [confirmMarkAll, runId, markAllPaidMutation]);

  // ---------------------------------------------------------------------------
  // Download export
  // ---------------------------------------------------------------------------

  const handleDownloadExport = useCallback(async () => {
    if (!runId) return;
    // Re-fetch via lockAndExport if run is already exported -- use cached export
    // For simplicity, we can re-trigger the export to get the file
    // The actual download is handled via the lockAndExport response stored externally
    // For now, show a toast -- the actual download flow runs through the dialog
    toast.info(t("toast.downloadHint"));
  }, [runId, t]);

  if (!run) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[400px] p-0">
          <div className="p-6 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-4 bg-muted animate-pulse rounded w-full"
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const status = run.status as string;
  const items = (run.items ?? []) as Array<{
    id: string;
    invoiceId: string;
    amountGrosze: number;
    currency: string;
    status: string;
    paymentReference: string | null;
    failureReason: string | null;
    invoice: { invoiceNumber: string; dueDate: string | null };
    contractor: { id: string; legalName: string };
  }>;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            {/* Header */}
            <SheetHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <SheetTitle className="text-[20px] font-semibold leading-[1.2]">
                  {run.runNumber ?? run.id.slice(0, 8)}
                </SheetTitle>
                <PaymentRunBadge status={status} />
              </div>
            </SheetHeader>

            <Separator />

            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <DetailItem
                label={t("sidePanel.created")}
                value={formatRelativeDate(run.createdAt)}
              />
              <DetailItem
                label={t("sidePanel.exportFormat")}
                value={run.exportFormat ?? "\u2014"}
              />
              <DetailItem
                label={t("sidePanel.invoices")}
                value={String(run.invoiceCount)}
              />
              <DetailItem
                label={t("sidePanel.total")}
                value={formatGrosze(run.totalGrosze, run.currency)}
                mono
              />
              {run.completedAt && (
                <DetailItem
                  label={t("sidePanel.completedDate")}
                  value={new Date(run.completedAt).toLocaleDateString("pl-PL")}
                />
              )}
            </div>

            <Separator />

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {/* DRAFT actions */}
              {status === "DRAFT" && (
                <CancelRunButton
                  status={status}
                  onConfirm={() => cancelMutation.mutate({ runId: runId! })}
                  isLoading={cancelMutation.isPending}
                  t={t}
                />
              )}

              {/* EXPORTED actions */}
              {(status === "EXPORTED" || status === "LOCKED") && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadExport}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    {t("sidePanel.downloadExport")}
                  </Button>
                  {status === "EXPORTED" && (
                    <>
                      <Button
                        size="sm"
                        onClick={handleMarkAllPaid}
                        disabled={markAllPaidMutation.isPending}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        {confirmMarkAll
                          ? t("sidePanel.confirmMarkAllPaid")
                          : t("sidePanel.markAllPaid")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onImportStatement?.(runId!)}
                      >
                        <FileUp className="mr-1.5 h-3.5 w-3.5" />
                        {t("sidePanel.importStatement")}
                      </Button>
                    </>
                  )}
                  <CancelRunButton
                    status={status}
                    onConfirm={() => cancelMutation.mutate({ runId: runId! })}
                    isLoading={cancelMutation.isPending}
                    t={t}
                  />
                </>
              )}

              {/* COMPLETED actions */}
              {status === "COMPLETED" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadExport}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {t("sidePanel.downloadExport")}
                </Button>
              )}
            </div>

            <Separator />

            {/* Invoice list */}
            <div className="space-y-2">
              <h3 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">
                {t("sidePanel.invoices")}
              </h3>
              <div className="space-y-1">
                {items.map((item) => (
                  <PaymentRunItemRow
                    key={item.id}
                    item={item}
                    runStatus={status}
                    runId={runId!}
                    onUpdateStatus={(itemId, itemStatus, ref, reason) =>
                      updateItemStatusMutation.mutate({
                        itemId,
                        status: itemStatus,
                        paymentReference: ref || undefined,
                        failureReason: reason || undefined,
                      })
                    }
                    onRemoveFromRun={(invoiceId) =>
                      removeFromRunMutation.mutate({
                        runId: runId!,
                        invoiceId,
                      })
                    }
                    t={t}
                  />
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Cancel run button with AlertDialog
// ---------------------------------------------------------------------------

function CancelRunButton({
  status,
  onConfirm,
  isLoading,
  t,
}: {
  status: string;
  onConfirm: () => void;
  isLoading: boolean;
  t: ReturnType<typeof useTranslations<"Payments">>;
}) {
  const isExported = status === "EXPORTED";
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="outline" size="sm" className="text-destructive" />
        }
      >
        <XCircle className="mr-1.5 h-3.5 w-3.5" />
        {t("sidePanel.cancelRun")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isExported
              ? t("cancelDialog.exportedTitle")
              : t("cancelDialog.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isExported
              ? t("cancelDialog.exportedBody")
              : t("cancelDialog.body")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancelDialog.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t("cancelDialog.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Payment run item row
// ---------------------------------------------------------------------------

function PaymentRunItemRow({
  item,
  runStatus,
  runId,
  onUpdateStatus,
  onRemoveFromRun,
  t,
}: {
  item: {
    id: string;
    invoiceId: string;
    amountGrosze: number;
    currency: string;
    status: string;
    paymentReference: string | null;
    invoice: { invoiceNumber: string };
    contractor: { id: string; legalName: string };
  };
  runStatus: string;
  runId: string;
  onUpdateStatus: (
    itemId: string,
    status: "PAID" | "FAILED",
    reference?: string,
    reason?: string,
  ) => void;
  onRemoveFromRun: (invoiceId: string) => void;
  t: ReturnType<typeof useTranslations<"Payments">>;
}) {
  const isTerminal = item.status === "PAID" || item.status === "FAILED";
  const isDraft = runStatus === "DRAFT";

  // Inline form state for mark paid/failed
  const [activeAction, setActiveAction] = useState<
    "paid" | "failed" | "remove" | null
  >(null);
  const [reference, setReference] = useState("");
  const [failureReason, setFailureReason] = useState("");

  return (
    <div className="py-2 px-2 rounded hover:bg-muted/50 text-sm">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/invoices/${item.invoiceId}`}
              className="text-primary hover:underline text-xs font-medium truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {item.invoice.invoiceNumber}
            </Link>
            <PaymentItemBadge status={item.status} />
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {item.contractor.legalName}
          </p>
          {item.paymentReference && (
            <p className="text-[12px] text-muted-foreground">
              Ref: {item.paymentReference}
            </p>
          )}
        </div>
        <span className="font-mono text-xs tabular-nums whitespace-nowrap">
          {formatGrosze(item.amountGrosze, item.currency)}
        </span>

        {/* Per-item actions */}
        {(!isTerminal || isDraft) && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={(props) => (
                <Button
                  {...props}
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onClick?.(e);
                  }}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              )}
            />
            <DropdownMenuContent align="end">
              {!isTerminal && (
                <>
                  <DropdownMenuItem
                    onClick={() => setActiveAction("paid")}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {t("sidePanel.markPaid")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setActiveAction("failed")}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    {t("sidePanel.markFailed")}
                  </DropdownMenuItem>
                </>
              )}
              {isDraft && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setActiveAction("remove")}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("sidePanel.removeFromRun")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Inline form for mark paid */}
      {activeAction === "paid" && (
        <div className="mt-2 p-2 rounded border bg-muted/30 space-y-2">
          <Label className="text-xs">{t("sidePanel.referenceLabel")}</Label>
          <Input
            placeholder={t("sidePanel.referencePlaceholder")}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="h-7 text-xs"
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="h-6 text-xs flex-1"
              onClick={() => {
                onUpdateStatus(item.id, "PAID", reference || undefined);
                setActiveAction(null);
                setReference("");
              }}
            >
              {t("sidePanel.confirm")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={() => {
                setActiveAction(null);
                setReference("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Inline form for mark failed */}
      {activeAction === "failed" && (
        <div className="mt-2 p-2 rounded border bg-muted/30 space-y-2">
          <Label className="text-xs">{t("sidePanel.failureReasonLabel")}</Label>
          <Textarea
            placeholder={t("sidePanel.failureReasonPlaceholder")}
            value={failureReason}
            onChange={(e) => setFailureReason(e.target.value)}
            className="h-14 text-xs resize-none"
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="destructive"
              className="h-6 text-xs flex-1"
              onClick={() => {
                if (failureReason.trim()) {
                  onUpdateStatus(
                    item.id,
                    "FAILED",
                    undefined,
                    failureReason.trim(),
                  );
                  setActiveAction(null);
                  setFailureReason("");
                }
              }}
              disabled={!failureReason.trim()}
            >
              {t("sidePanel.confirm")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={() => {
                setActiveAction(null);
                setFailureReason("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Inline confirm for remove from run */}
      {activeAction === "remove" && (
        <div className="mt-2 p-2 rounded border bg-destructive/5 space-y-2">
          <p className="text-xs text-muted-foreground">
            {t("sidePanel.removeFromRunConfirm")}
          </p>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="destructive"
              className="h-6 text-xs flex-1"
              onClick={() => {
                onRemoveFromRun(item.invoiceId);
                setActiveAction(null);
              }}
            >
              {t("sidePanel.removeButton")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={() => setActiveAction(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Mark paid/failed/remove actions are now handled via dropdown items
// that trigger the action directly. For mark paid, we use a simple
// one-click approach (reference can be added later). For mark failed,
// we use an inline form below the item row via state.

// ---------------------------------------------------------------------------
// Detail item
// ---------------------------------------------------------------------------

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-[13px]" : "text-sm"}>
        {value ?? <span className="text-muted-foreground">&mdash;</span>}
      </dd>
    </div>
  );
}
