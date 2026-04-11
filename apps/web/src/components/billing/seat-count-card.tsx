"use client";

import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from "@/components/ui/progress";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SeatCountCardProps {
  activeContractors: number;
  includedSeats: number;
  seatPriceMinor: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SeatCountCard({
  activeContractors,
  includedSeats,
  seatPriceMinor,
}: SeatCountCardProps) {
  const t = useTranslations("Billing.usage");

  const overage = Math.max(0, activeContractors - includedSeats);
  const maxSeats = Math.max(includedSeats, activeContractors);
  const fillPercent = maxSeats > 0 ? (activeContractors / maxSeats) * 100 : 0;
  const pricePerSeat = seatPriceMinor / 100;

  return (
    <Card className="p-4">
      <CardContent className="flex flex-col gap-1 p-0">
        <div className="flex items-start justify-between">
          <span className="text-xs text-muted-foreground">
            {t("activeSeats")}
          </span>
          <Users size={16} className="text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="text-2xl font-semibold">{activeContractors}</div>
        <span className="text-xs text-muted-foreground">
          {t("active", {
            active: String(activeContractors),
            included: String(includedSeats),
          })}
        </span>

        <Progress
          value={fillPercent}
          aria-valuenow={activeContractors}
          aria-valuemin={0}
          aria-valuemax={maxSeats}
          aria-label={t("active", {
            active: String(activeContractors),
            included: String(includedSeats),
          })}
          className="mt-2"
        >
          <ProgressTrack>
            <ProgressIndicator
              style={{
                backgroundColor:
                  overage > 0 ? "var(--warning)" : "var(--primary)",
              }}
            />
          </ProgressTrack>
        </Progress>

        {overage > 0 && (
          <span className="text-xs text-warning mt-1">
            {t("overage", {
              overage: String(overage),
              price: String(pricePerSeat),
            })}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
