"use client";

import { Gem } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PremiumBadgeProps {
  tier: "Pro" | "Enterprise";
}

export function PremiumBadge({ tier }: PremiumBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex items-center">
        <Gem
          size={14}
          className="text-muted-foreground"
          aria-label={`Requires ${tier} plan`}
        />
      </TooltipTrigger>
      <TooltipContent>Available on {tier} plan</TooltipContent>
    </Tooltip>
  );
}
