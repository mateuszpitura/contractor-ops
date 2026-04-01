"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { trpc } from "@/trpc/init";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
  const [selectedBundle, setSelectedBundle] = useState<string>("10");

  const checkoutMutation = useMutation({
    ...trpc.billing.createCheckoutSession.mutationOptions(),
    onSuccess(data) {
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      }
    },
    onError() {
      toast.error("Failed to start checkout. Please try again.");
    },
  });

  function handleConfirm() {
    // Use a dedicated top-up price ID based on bundle selection
    // For now, this will route through the standard checkout flow
    const priceIdMap: Record<string, string> = {
      "10": process.env.NEXT_PUBLIC_STRIPE_PRICE_TOPUP_10 ?? "price_topup_10",
      "25": process.env.NEXT_PUBLIC_STRIPE_PRICE_TOPUP_25 ?? "price_topup_25",
      "50": process.env.NEXT_PUBLIC_STRIPE_PRICE_TOPUP_50 ?? "price_topup_50",
    };
    const priceId = priceIdMap[selectedBundle] ?? priceIdMap["10"]!;
    checkoutMutation.mutate({ priceId });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buy OCR Credits</DialogTitle>
          <DialogDescription>
            Select a credit bundle. You will be redirected to Stripe to
            complete the purchase.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Select value={selectedBundle} onValueChange={setSelectedBundle}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select bundle size" />
            </SelectTrigger>
            <SelectContent>
              {CREDIT_BUNDLES.map((bundle) => (
                <SelectItem key={bundle.value} value={bundle.value}>
                  {bundle.label} ({bundle.priceLabel})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="text-xs text-muted-foreground">
            Exact price will be confirmed on the Stripe checkout page.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={checkoutMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={checkoutMutation.isPending}
          >
            {checkoutMutation.isPending && (
              <Loader2 className="animate-spin" aria-hidden="true" />
            )}
            Continue to checkout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
