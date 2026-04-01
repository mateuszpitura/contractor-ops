"use client";

import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/trpc/init";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProrationPreviewProps {
  newPriceId: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProrationPreview({
  newPriceId,
  onConfirm,
  onCancel,
}: ProrationPreviewProps) {
  const { data, isLoading, isError } = useQuery(
    trpc.billing.getProrationPreview.queryOptions({ newPriceId }),
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 py-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-destructive">
            Failed to load proration preview. Please try again.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalPLN = data.totalGrosze / 100;
  const isCredit = totalPLN < 0;

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <h3 className="text-sm font-semibold">Plan change preview</h3>

        {/* Line items */}
        <ul className="space-y-2">
          {data.lines.map(
            (
              line: { description: string; amountGrosze: number },
              index: number,
            ) => (
              <li
                key={index}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">
                  {line.description}
                </span>
                <span className="tabular-nums font-medium">
                  {(line.amountGrosze / 100).toFixed(2)} PLN
                </span>
              </li>
            ),
          )}
        </ul>

        <Separator />

        {/* Total */}
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>Total</span>
          <span className="tabular-nums">
            {Math.abs(totalPLN).toFixed(2)} PLN
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          {isCredit
            ? `You will receive a credit of ${Math.abs(totalPLN).toFixed(2)} PLN for the unused portion of your current plan.`
            : `You will be charged ${totalPLN.toFixed(2)} PLN today for the remainder of your billing period.`}
        </p>

        <div className="flex gap-2">
          <Button size="sm" onClick={onConfirm}>
            Confirm change
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
