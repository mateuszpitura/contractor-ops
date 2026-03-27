"use client";

import { Clock } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DeviationFlag } from "@/components/time/deviation-flag";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimeReconciliation {
  approvedMinutes: number;
  rateValueGrosze: number;
  rateType: string;
  hoursPerDay: number;
  expectedAmountGrosze: number;
  invoicedAmountGrosze: number;
  deviationGrosze: number;
  deviationPercent: number;
  withinThreshold: boolean;
  thresholdPercent: number;
}

interface ReconciliationCardProps {
  reconciliation: TimeReconciliation;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatGrosze(grosze: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(grosze / 100);
}

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours}` : hours.toFixed(1);
}

function formatRate(grosze: number): string {
  return new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(grosze / 100);
}

// ---------------------------------------------------------------------------
// Border color by severity
// ---------------------------------------------------------------------------

function getBorderColor(
  deviationPercent: number,
  thresholdPercent: number,
): string {
  if (deviationPercent <= thresholdPercent) {
    return "border-l-green-600 dark:border-l-green-500";
  }
  if (deviationPercent <= 2 * thresholdPercent) {
    return "border-l-amber-500 dark:border-l-amber-400";
  }
  return "border-l-destructive";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Time reconciliation card for invoice detail page (D-16).
 *
 * Shows approved hours, expected amount, invoiced amount, and deviation flag.
 * Visual comparison bar shows ratio of expected to actual.
 * Only rendered when reconciliation data is available (non-null).
 */
export function ReconciliationCard({ reconciliation }: ReconciliationCardProps) {
  const {
    approvedMinutes,
    rateValueGrosze,
    expectedAmountGrosze,
    invoicedAmountGrosze,
    deviationPercent,
    thresholdPercent,
  } = reconciliation;

  const borderColor = getBorderColor(deviationPercent, thresholdPercent);
  const hours = formatHours(approvedMinutes);
  const rate = formatRate(rateValueGrosze);

  // Visual comparison bar: ratio of expected to actual
  const maxAmount = Math.max(expectedAmountGrosze, invoicedAmountGrosze);
  const expectedRatio =
    maxAmount > 0 ? (expectedAmountGrosze / maxAmount) * 100 : 0;
  const invoicedRatio =
    maxAmount > 0 ? (invoicedAmountGrosze / maxAmount) * 100 : 0;
  const hasOverflow = invoicedAmountGrosze > expectedAmountGrosze;

  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Time Reconciliation</span>
          </div>
          <DeviationFlag
            deviationPercent={deviationPercent}
            thresholdPercent={thresholdPercent}
            expectedAmountGrosze={expectedAmountGrosze}
            invoicedAmountGrosze={invoicedAmountGrosze}
            rateValueGrosze={rateValueGrosze}
            approvedMinutes={approvedMinutes}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 3-stat responsive grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Approved Hours */}
          <div className="space-y-0.5">
            <span className="text-[13px] text-muted-foreground">
              Approved Hours
            </span>
            <p className="text-lg font-semibold tabular-nums">{hours}h</p>
            <p className="text-xs text-muted-foreground">
              at {rate}/h
            </p>
          </div>

          {/* Expected Amount */}
          <div className="space-y-0.5">
            <span className="text-[13px] text-muted-foreground">
              Expected Amount
            </span>
            <p className="text-lg font-semibold tabular-nums">
              {formatGrosze(expectedAmountGrosze)}
            </p>
            <p className="text-xs text-muted-foreground">
              based on approved hours
            </p>
          </div>

          {/* Invoiced Amount */}
          <div className="space-y-0.5">
            <span className="text-[13px] text-muted-foreground">
              Invoiced Amount
            </span>
            <p className="text-lg font-semibold tabular-nums">
              {formatGrosze(invoicedAmountGrosze)}
            </p>
            <p className="text-xs text-muted-foreground">
              from invoice
            </p>
          </div>
        </div>

        {/* Visual comparison bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Expected</span>
            <span>Invoiced</span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
            {/* Expected portion */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary/60 transition-all duration-300 ease-out"
              style={{ width: `${expectedRatio}%` }}
            />
            {/* Invoiced overflow (only when actual > expected) */}
            {hasOverflow && (
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-destructive/40 transition-all duration-300 ease-out"
                style={{ width: `${invoicedRatio}%` }}
              />
            )}
            {/* Expected overlay on top when there's overflow */}
            {hasOverflow && (
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary/60 transition-all duration-300 ease-out"
                style={{ width: `${expectedRatio}%` }}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
