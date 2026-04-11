"use client";

import { Check, X } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanTier {
  name: string;
  basePriceMinor: number;
  seatPriceMinor: number;
  creditAllowance: number;
  features: string[];
  excludedFeatures: string[];
  description: string;
}

export type PlanCtaMode = "choose" | "upgrade" | "change" | "current";

interface PlanCardProps {
  tier: PlanTier;
  ctaMode: PlanCtaMode;
  isRecommended: boolean;
  onSelect: () => void;
  disabled?: boolean;
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPLN(minor: number): string {
  return String(minor / 100);
}

const CTA_CONFIG: Record<PlanCtaMode, { label: string; variant: "default" | "outline" }> = {
  choose: { label: "Choose a plan", variant: "default" },
  upgrade: { label: "Upgrade plan", variant: "default" },
  change: { label: "Change plan", variant: "outline" },
  current: { label: "Current plan", variant: "outline" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlanCard({
  tier,
  ctaMode,
  isRecommended,
  onSelect,
  disabled,
  compact,
}: PlanCardProps) {
  const isCurrentPlan = ctaMode === "current";
  const cta = CTA_CONFIG[ctaMode];

  return (
    <Card
      role="radio"
      aria-checked={isCurrentPlan}
      tabIndex={0}
      className={cn(
        "flex flex-col transition-shadow",
        isCurrentPlan && "ring-2 ring-primary",
        isRecommended && !isCurrentPlan && "ring-2 ring-primary/50",
        compact && "py-3",
      )}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!isCurrentPlan && !disabled) onSelect();
        }
      }}
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{tier.name}</span>
          {isCurrentPlan && <Badge variant="default">Current plan</Badge>}
          {isRecommended && !isCurrentPlan && (
            <Badge variant="success">Recommended</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{tier.description}</p>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        {/* Price display */}
        <div>
          <span className="font-display text-[28px] font-semibold leading-tight tabular-nums">
            {formatPLN(tier.basePriceMinor)} PLN
          </span>
          <span className="text-sm text-muted-foreground">/month</span>
        </div>

        <p className="text-sm text-muted-foreground">
          +{formatPLN(tier.seatPriceMinor)} PLN per contractor
        </p>

        <p className="text-sm text-muted-foreground">
          {tier.creditAllowance} OCR credits/month included
        </p>

        {/* Feature list */}
        <ul className="flex flex-col gap-2">
          {tier.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <Check
                size={16}
                className="mt-0.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              {feature}
            </li>
          ))}
          {!compact &&
            tier.excludedFeatures.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <X
                  size={16}
                  className="mt-0.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                {feature}
              </li>
            ))}
        </ul>
      </CardContent>

      <CardFooter>
        <Button
          variant={cta.variant}
          className="w-full"
          disabled={isCurrentPlan || disabled}
          onClick={onSelect}
        >
          {cta.label}
        </Button>
      </CardFooter>
    </Card>
  );
}
