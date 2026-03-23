"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { trpc } from "@/trpc/init";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VoidEnvelopeDialogProps = {
  envelopeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVoided: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Destructive confirmation dialog for voiding a signing envelope.
 * Per UI-SPEC D-11 — AlertDialog pattern with optional reason.
 */
export function VoidEnvelopeDialog({
  envelopeId,
  open,
  onOpenChange,
  onVoided,
}: VoidEnvelopeDialogProps) {
  const [reason, setReason] = useState("");

  const voidMutation = useMutation(
    trpc.esign.voidEnvelope.mutationOptions({
      onSuccess: () => {
        toast.success("Signing envelope voided");
        onOpenChange(false);
        setReason("");
        onVoided();
      },
      onError: () => {
        toast.error("Failed to void envelope. Please try again.");
      },
    })
  );

  function handleConfirm() {
    voidMutation.mutate({
      envelopeId,
      reason: reason.trim() || "Voided by admin",
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Void Signing Envelope</AlertDialogTitle>
          <AlertDialogDescription>
            This will cancel the signing process for all parties. Signers will
            be notified. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="void-reason">Reason (optional)</Label>
          <Textarea
            id="void-reason"
            rows={2}
            placeholder="Why are you voiding this envelope?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Keep Active</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleConfirm}
            disabled={voidMutation.isPending}
          >
            {voidMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Voiding...
              </>
            ) : (
              "Void Envelope"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
