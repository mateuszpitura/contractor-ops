"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { trpc } from "@/trpc/init";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "@/i18n/navigation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const currencyFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatAmount(grosze: number, currency: string): string {
  if (currency !== "PLN") {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(grosze / 100);
  }
  return currencyFormatter.format(grosze / 100);
}

function getSlaVariant(status: string): "success" | "warning" | "destructive" | "secondary" {
  switch (status) {
    case "green":
      return "success";
    case "yellow":
      return "warning";
    case "red":
    case "overdue":
      return "destructive";
    default:
      return "secondary";
  }
}

/** Left border accent color per SLA status */
function getSlaAccent(status: string): string {
  switch (status) {
    case "green":
      return "border-l-success";
    case "yellow":
      return "border-l-warning";
    case "red":
    case "overdue":
      return "border-l-destructive";
    default:
      return "border-l-muted-foreground/30";
  }
}

const SLA_LABEL_KEYS: Record<string, string> = {
  green: "approvals.slaOnTrack",
  yellow: "approvals.slaApproaching",
  red: "approvals.slaBreached",
  overdue: "approvals.slaBreached",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Approval queue widget showing top 5 pending approvals with SLA badges.
 * Color-coded left border per SLA status. Glowing badges on breached items.
 */
export function ApprovalQueueWidget() {
  const t = useTranslations("Dashboard");
  const { data, isLoading } = useQuery(
    trpc.approval.listPending.queryOptions({ page: 1, pageSize: 5 }),
  );

  const items = data?.items ?? [];

  return (
    <Card className="neon-card">
      <CardHeader>
        <CardTitle className="font-display text-lg font-semibold">
          {t("approvals.title")}
        </CardTitle>
        <CardAction>
          <Link
            href="/approvals"
            className="text-sm text-primary hover:underline"
          >
            {t("approvals.seeAll")}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("approvals.empty")}
          </p>
        ) : (
          <ScrollArea className="scroll-fade-bottom max-h-[280px]">
            <div className="flex flex-col gap-2">
              {items.map((item) => {
                const invoice = item.invoice;
                const contractorName =
                  invoice?.contractor?.legalName ?? invoice?.sellerName ?? "---";
                const amount = invoice?.totalGrosze ?? 0;
                const currency = invoice?.currency ?? "PLN";
                const invoiceId = item.approvalFlow?.resourceId;
                const slaStatus = item.slaStatus?.status ?? "";
                const accent = getSlaAccent(slaStatus);
                const isBreached = slaStatus === "red" || slaStatus === "overdue";

                return (
                  <Link
                    key={item.id}
                    href={invoiceId ? `/invoices/${invoiceId}` : "/approvals"}
                    className={`flex items-center gap-3 rounded-lg border-l-2 ${accent} pl-3 pr-2.5 py-2.5 transition-all duration-200 hover:bg-surface-2 hover:pl-3.5`}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {contractorName}
                    </span>
                    <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-foreground">
                      {formatAmount(amount, currency)}
                    </span>
                    {item.slaStatus && (
                      <Badge
                        variant={getSlaVariant(slaStatus)}
                        className={isBreached ? "badge-glow" : ""}
                      >
                        {t((SLA_LABEL_KEYS[slaStatus] ?? slaStatus) as Parameters<typeof t>[0])}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
