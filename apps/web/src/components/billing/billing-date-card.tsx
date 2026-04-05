"use client";

import { useTranslations, useFormatter } from "next-intl";
import { Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BillingDateCardProps {
  date: string | null;
  isTrialing: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BillingDateCard({ date, isTrialing }: BillingDateCardProps) {
  const t = useTranslations("Billing.usage");
  const format = useFormatter();

  const formattedDate = date
    ? format.dateTime(new Date(date), {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <Card className="p-4">
      <CardContent className="flex flex-col gap-1 p-0">
        <div className="flex items-start justify-between">
          <span className="text-xs text-muted-foreground">
            {t("nextBillingDate")}
          </span>
          <Calendar
            size={16}
            className="text-muted-foreground"
            aria-hidden="true"
          />
        </div>
        <div className="text-2xl font-semibold">
          {formattedDate ?? "\u2014"}
        </div>
        {formattedDate && (
          <span className="text-xs text-muted-foreground">
            {isTrialing ? t("trialEnds") : t("renewsOn")}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
