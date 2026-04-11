"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/trpc/init";

// ---------------------------------------------------------------------------
// Field label key mapping
// ---------------------------------------------------------------------------

const FIELD_LABEL_KEYS: Record<string, string> = {
  bankAccountNumber: "bankAccount",
  bankName: "bankName",
  swiftBic: "swiftBic",
  taxId: "taxId",
  displayName: "displayName",
  phone: "phone",
  addressLine1: "addressLine1",
  addressLine2: "addressLine2",
  city: "city",
  postalCode: "postalCode",
  countryCode: "country",
};

// ---------------------------------------------------------------------------
// Status badge variant mapping (per UI-SPEC)
// ---------------------------------------------------------------------------

const STATUS_BADGE_VARIANTS = {
  PENDING: "warning" as const,
  APPROVED: "success" as const,
  REJECTED: "destructive" as const,
} as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChangeRequestDiffCardProps {
  request: {
    id: string;
    contractorName: string;
    contractorEmail: string;
    requestedChanges: Record<string, unknown>;
    previousValues: Record<string, unknown>;
    createdAt: Date | string;
    status: "PENDING" | "APPROVED" | "REJECTED";
  };
  onApproved?: () => void;
  onRejected?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Admin change request review card with field-by-field diff table.
 *
 * Shows contractor name, email, submission timestamp, diff table,
 * and approve/reject actions for PENDING requests.
 * Shows status badge for APPROVED/REJECTED requests.
 */
export function ChangeRequestDiffCard({
  request,
  onApproved,
  onRejected,
}: ChangeRequestDiffCardProps) {
  const t = useTranslations("Settings.changeRequest");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState("");

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const approveMutation = useMutation(
    trpc.settings.reviewChangeRequest.mutationOptions({
      onSuccess: () => {
        toast.success(t("toast.approved"));
        onApproved?.();
      },
      onError: () => {
        toast.error(t("toast.approveFailed"));
      },
    }),
  );

  const rejectMutation = useMutation(
    trpc.settings.reviewChangeRequest.mutationOptions({
      onSuccess: () => {
        toast.success(t("toast.rejected"));
        setRejectDialogOpen(false);
        setRejectComment("");
        onRejected?.();
      },
      onError: () => {
        toast.error(t("toast.rejectFailed"));
      },
    }),
  );

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleApprove = () => {
    approveMutation.mutate({
      requestId: request.id,
      action: "approve",
    });
  };

  const handleRejectConfirm = () => {
    rejectMutation.mutate({
      requestId: request.id,
      action: "reject",
      comment: rejectComment || undefined,
    });
  };

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  const changedFields = Object.keys(request.requestedChanges);
  const createdAt =
    typeof request.createdAt === "string"
      ? new Date(request.createdAt)
      : request.createdAt;
  const statusVariant = STATUS_BADGE_VARIANTS[request.status];

  function getFieldLabel(key: string): string {
    const labelKey = FIELD_LABEL_KEYS[key];
    if (labelKey) {
      return t(`fieldLabels.${labelKey}` as Parameters<typeof t>[0]);
    }
    return key.replace(/([A-Z])/g, " $1").trim();
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold">
                {t("title")}
              </h4>
              <p className="text-sm text-muted-foreground">
                {request.contractorName} &middot; {request.contractorEmail}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDistanceToNow(createdAt, { addSuffix: true })}
              </p>
            </div>
            {request.status !== "PENDING" && (
              <Badge variant={statusVariant}>{t(`status.${request.status}`)}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Diff table */}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th scope="col" className="px-3 py-2 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("table.field")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("table.currentValue")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("table.requestedValue")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {changedFields.map((key) => (
                  <tr key={key} className="border-b last:border-b-0 bg-muted">
                    <td className="px-3 py-2 text-muted-foreground">
                      {getFieldLabel(key)}
                    </td>
                    <td className="px-3 py-2">
                      {String(request.previousValues[key] ?? "-")}
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      {String(request.requestedChanges[key] ?? "-")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action buttons (only for PENDING) */}
          {request.status === "PENDING" && (
            <div className="flex items-center gap-2">
              <Button
                onClick={handleApprove}
                disabled={
                  approveMutation.isPending || rejectMutation.isPending
                }
              >
                {approveMutation.isPending ? t("approving") : t("approveChanges")}
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setRejectDialogOpen(true)}
                disabled={
                  approveMutation.isPending || rejectMutation.isPending
                }
              >
                {t("rejectChanges")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject confirmation dialog */}
      <Dialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectTitle")}</DialogTitle>
            <DialogDescription>
              {t("rejectDescription")}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={t("rejectPlaceholder")}
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending
                ? t("rejecting")
                : t("confirmRejection")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
