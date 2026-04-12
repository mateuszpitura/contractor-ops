"use client";

import { startOfMonth, subMonths } from "date-fns";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { Suspense, useMemo } from "react";
import { ComplianceGapsReport } from "@/components/reports/compliance-gaps-report";
import { DateRangeFilter } from "@/components/reports/date-range-filter";
import { ExpiringContractsReport } from "@/components/reports/expiring-contracts-report";
import { OverdueInvoicesReport } from "@/components/reports/overdue-invoices-report";
import { ReportSidebar } from "@/components/reports/report-sidebar";
import { SpendContractorReport } from "@/components/reports/spend-contractor-report";
import { SpendTeamReport } from "@/components/reports/spend-team-report";
import { AnimateIn } from "@/components/shared/animate-in";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/use-permissions";
import { useRouter } from "@/i18n/navigation";

function getDefaultDateRange() {
  const now = new Date();
  return {
    from: subMonths(startOfMonth(now), 3).toISOString(),
    to: now.toISOString(),
  };
}

function ReportsContent() {
  const t = useTranslations("Reports");
  const router = useRouter();
  const { can } = usePermissions();

  // Redirect if no permission
  if (!can("report", ["read"])) {
    router.push("/unauthorized");
    return null;
  }

  const defaults = useMemo(() => getDefaultDateRange(), []);

  const [report, setReport] = useQueryState(
    "report",
    parseAsString.withDefault("spend-contractor"),
  );

  const [dateFrom, setDateFrom] = useQueryState(
    "dateFrom",
    parseAsString.withDefault(defaults.from),
  );

  const [dateTo, setDateTo] = useQueryState("dateTo", parseAsString.withDefault(defaults.to));

  const handleDateChange = (from: string, to: string) => {
    void setDateFrom(from);
    void setDateTo(to);
  };

  const activeReport = (() => {
    switch (report) {
      case "spend-contractor":
        return <SpendContractorReport dateFrom={dateFrom} dateTo={dateTo} />;
      case "spend-team":
        return <SpendTeamReport dateFrom={dateFrom} dateTo={dateTo} />;
      case "expiring-contracts":
        return <ExpiringContractsReport dateFrom={dateFrom} dateTo={dateTo} />;
      case "overdue-invoices":
        return <OverdueInvoicesReport dateFrom={dateFrom} dateTo={dateTo} />;
      case "compliance-gaps":
        return <ComplianceGapsReport dateFrom={dateFrom} dateTo={dateTo} />;
      default:
        return <SpendContractorReport dateFrom={dateFrom} dateTo={dateTo} />;
    }
  })();

  return (
    <div className="space-y-6">
      {/* Mobile sidebar (horizontal pill bar) */}
      <div className="lg:hidden">
        <ReportSidebar activeReport={report} onSelect={(r) => void setReport(r)} />
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <ReportSidebar activeReport={report} onSelect={(r) => void setReport(r)} />
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Header */}
          <AnimateIn delay={0}>
            <h1 className="font-display text-[22px] font-semibold leading-tight tracking-tight">
              {t("title")}
            </h1>
          </AnimateIn>

          {/* Date range filter */}
          <AnimateIn delay={1}>
            <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onDateChange={handleDateChange} />
          </AnimateIn>

          {/* Active report */}
          <AnimateIn delay={2}>{activeReport}</AnimateIn>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[240px] w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}
