"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreditExhaustedInlineProps {
  onUpgrade: () => void;
  onBuyCredits: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreditExhaustedInline({
  onUpgrade,
  onBuyCredits,
}: CreditExhaustedInlineProps) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle
          size={20}
          className="mt-0.5 shrink-0 text-destructive"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-destructive">
            OCR credits exhausted
          </h3>
          <p className="text-sm text-muted-foreground">
            You have used all OCR credits this month. Upgrade your plan for more
            credits or purchase a top-up bundle.
          </p>
        </div>
      </div>
      <div className="flex gap-2 ps-8">
        <Button variant="default" size="sm" onClick={onUpgrade}>
          Upgrade plan
        </Button>
        <Button variant="outline" size="sm" onClick={onBuyCredits}>
          Buy credits
        </Button>
      </div>
    </div>
  );
}
