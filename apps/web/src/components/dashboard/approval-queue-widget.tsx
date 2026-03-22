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

function getSlaClassName(status: string): string {
  switch (status) {
    case "ON_TRACK":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "APPROACHING":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "BREACHED":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getSlaLabel(status: string): string {
  switch (status) {
    case "ON_TRACK":
      return "On track";
    case "APPROACHING":
      return "Approaching";
    case "BREACHED":
      return "Breached";
    default:
      return status;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Approval queue widget showing top 5 pending approvals with SLA badges.
 * Reuses the existing approval.listPending tRPC procedure.
 */
export function ApprovalQueueWidget() {
  const t = useTranslations("Dashboard");
  const { data, isLoading } = useQuery(
    trpc.approval.listPending.queryOptions({ page: 1, pageSize: 5 }),
  );

  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[20px] font-semibold">
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
          <ScrollArea className="max-h-[280px]">
            <div className="flex flex-col gap-2">
              {items.map((item) => {
                const invoice = item.invoice;
                const contractorName =
                  invoice?.contractor?.legalName ?? invoice?.sellerName ?? "---";
                const amount = invoice?.totalGrosze ?? 0;
                const currency = invoice?.currency ?? "PLN";
                const invoiceId = item.approvalFlow?.resourceId;

                return (
                  <Link
                    key={item.id}
                    href={invoiceId ? `/invoices/${invoiceId}` : "/approvals"}
                    className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {contractorName}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {formatAmount(amount, currency)}
                    </span>
                    {item.slaStatus && (
                      <Badge
                        variant="secondary"
                        className={getSlaClassName(item.slaStatus.status)}
                      >
                        {getSlaLabel(item.slaStatus.status)}
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
