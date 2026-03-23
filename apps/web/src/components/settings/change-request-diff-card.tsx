"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

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
// Field label mapping
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  bankAccountNumber: "Bank Account",
  bankName: "Bank Name",
  swiftBic: "SWIFT/BIC",
  taxId: "Tax ID",
  displayName: "Display Name",
  phone: "Phone",
  addressLine1: "Address Line 1",
  addressLine2: "Address Line 2",
  city: "City",
  postalCode: "Postal Code",
  countryCode: "Country",
};

function getFieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").trim();
}

// ---------------------------------------------------------------------------
// Status badge mapping (per UI-SPEC)
// ---------------------------------------------------------------------------

const STATUS_BADGE_MAP = {
  PENDING: { variant: "warning" as const, label: "Pending" },
  APPROVED: { variant: "success" as const, label: "Approved" },
  REJECTED: { variant: "destructive" as const, label: "Rejected" },
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
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState("");

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const approveMutation = useMutation(
    trpc.settings.reviewChangeRequest.mutationOptions({
      onSuccess: () => {
        toast.success(
          "Change request approved. Contractor profile updated.",
        );
        onApproved?.();
      },
      onError: () => {
        toast.error("Failed to approve change request. Please try again.");
      },
    }),
  );

  const rejectMutation = useMutation(
    trpc.settings.reviewChangeRequest.mutationOptions({
      onSuccess: () => {
        toast.success(
          "Change request rejected. Contractor has been notified.",
        );
        setRejectDialogOpen(false);
        setRejectComment("");
        onRejected?.();
      },
      onError: () => {
        toast.error("Failed to reject change request. Please try again.");
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
  const statusBadge = STATUS_BADGE_MAP[request.status];

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
                Profile Change Request
              </h4>
              <p className="text-sm text-muted-foreground">
                {request.contractorName} &middot; {request.contractorEmail}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDistanceToNow(createdAt, { addSuffix: true })}
              </p>
            </div>
            {request.status !== "PENDING" && (
              <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Diff table */}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Field
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Current Value
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Requested Value
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
                {approveMutation.isPending ? "Approving..." : "Approve Changes"}
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setRejectDialogOpen(true)}
                disabled={
                  approveMutation.isPending || rejectMutation.isPending
                }
              >
                Reject Changes
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
            <DialogTitle>Reject Change Request</DialogTitle>
            <DialogDescription>
              Optionally provide a reason for rejection. The contractor will
              be notified.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection (optional)"
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
                ? "Rejecting..."
                : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
