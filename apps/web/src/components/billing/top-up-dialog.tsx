"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/trpc/init";

// ---------------------------------------------------------------------------
// Credit bundles
// ---------------------------------------------------------------------------

const CREDIT_BUNDLES = [
  { value: "10", label: "10 credits", priceLabel: "~49 PLN" },
  { value: "25", label: "25 credits", priceLabel: "~109 PLN" },
  { value: "50", label: "50 credits", priceLabel: "~199 PLN" },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TopUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TopUpDialog({ open, onOpenChange }: TopUpDialogProps) {
  const t = useTranslations("Billing.topUp");
  const [selectedBundle, setSelectedBundle] = useState<string>("10");

  const checkoutMutation = useMutation({
    ...trpc.billing.createTopUpCheckout.mutationOptions(),
    onSuccess(data) {
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      }
    },
    onError() {
      toast.error(t("errors.checkoutFailed"));
    },
  });

  function handleConfirm() {
    const priceIdMap: Record<string, string> = {
      "10": process.env.NEXT_PUBLIC_STRIPE_PRICE_TOPUP_10 ?? "",
      "25": process.env.NEXT_PUBLIC_STRIPE_PRICE_TOPUP_25 ?? "",
      "50": process.env.NEXT_PUBLIC_STRIPE_PRICE_TOPUP_50 ?? "",
    };
    const priceId = priceIdMap[selectedBundle];
    if (!priceId) {
      toast.error(t("errors.priceNotConfigured"));
      return;
    }
    checkoutMutation.mutate({ priceId });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Select value={selectedBundle} onValueChange={setSelectedBundle}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("selectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {CREDIT_BUNDLES.map((bundle) => (
                <SelectItem key={bundle.value} value={bundle.value}>
                  {bundle.label} ({bundle.priceLabel})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="text-xs text-muted-foreground">{t("priceNote")}</p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={checkoutMutation.isPending}
          >
            {t("cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={checkoutMutation.isPending}>
            {checkoutMutation.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
