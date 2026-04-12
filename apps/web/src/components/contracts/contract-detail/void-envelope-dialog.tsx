"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/trpc/init";

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
  const t = useTranslations("ContractDetail.signing.voidDialog");
  const tToast = useTranslations("ContractDetail.signing.toast");
  const [reason, setReason] = useState("");

  const voidMutation = useMutation(
    trpc.esign.voidEnvelope.mutationOptions({
      onSuccess: () => {
        toast.success(tToast("voidSuccess"));
        onOpenChange(false);
        setReason("");
        onVoided();
      },
      onError: () => {
        toast.error(tToast("voidFailed"));
      },
    }),
  );

  function handleConfirm() {
    voidMutation.mutate({
      envelopeId,
      reason: reason.trim() || t("defaultReason"),
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="void-reason">{t("reasonLabel")}</Label>
          <Textarea
            id="void-reason"
            rows={2}
            placeholder={t("reasonPlaceholder")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t("keepActive")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleConfirm}
            disabled={voidMutation.isPending}
          >
            {voidMutation.isPending ? (
              <>
                <Loader2 className="me-1.5 size-4 animate-spin" />
                {t("voiding")}
              </>
            ) : (
              t("voidEnvelope")
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
