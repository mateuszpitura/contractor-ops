"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/trpc/init";
import { DrillDownBreadcrumb } from "./drill-down-breadcrumb";
import { downloadBase64File, ExportButtons } from "./export-buttons";
import { ReportChart } from "./report-chart";
import { ReportTable } from "./report-table";

function formatCurrency(minor: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

interface SpendTeamReportProps {
  dateFrom: string;
  dateTo: string;
}

type TeamSpendRow = {
  teamId: string | null;
  teamName: string | null;
  contractorCount: number;
  invoiceCount: number;
  totalMinor: number;
};

export function SpendTeamReport({ dateFrom, dateTo }: SpendTeamReportProps) {
  const t = useTranslations("Reports");

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("totalSpend");
  const [sortOrder, setSortOrder] = useState("desc");
  const [drillDownTeamId, setDrillDownTeamId] = useState<string | null>(null);

  const tableQuery = useQuery(
    trpc.report.spendByTeam.queryOptions({
      dateFrom,
      dateTo,
      page,
      pageSize: 20,
      sortBy: sortBy as "totalSpend" | "invoiceCount" | "teamName",
      sortOrder: sortOrder as "asc" | "desc",
    }),
  );

  const chartQuery = useQuery(trpc.report.spendByTeamChart.queryOptions({ dateFrom, dateTo }));

  const exportMutation = useMutation(
    trpc.report.exportSpendByTeam.mutationOptions({
      onSuccess: (data) => {
        const result = data as {
          data: string;
          filename: string;
          mimeType: string;
        };
        downloadBase64File(result.data, result.filename, result.mimeType);
        toast.success(t("exportSuccess", { count: tableData.length }));
      },
      onError: () => {
        toast.error(t("exportError"));
      },
    }),
  );

  const tableData = useMemo(() => {
    const result = tableQuery.data as { items: TeamSpendRow[]; totalCount: number } | undefined;
    return result?.items ?? [];
  }, [tableQuery.data]);

  const totalCount = useMemo(() => {
    const result = tableQuery.data as { items: TeamSpendRow[]; totalCount: number } | undefined;
    return result?.totalCount ?? 0;
  }, [tableQuery.data]);

  const chartData = useMemo(() => {
    const raw = (chartQuery.data ?? []) as Array<{
      teamId: string | null;
      teamName: string | null;
      totalMinor: number;
    }>;
    return raw.map((item) => ({
      ...item,
      teamName: item.teamName ?? t("unassignedTeam"),
    }));
  }, [chartQuery.data, t]);

  const drillDownName = useMemo(() => {
    if (!drillDownTeamId) return null;
    const item = tableData.find((d) => d.teamId === drillDownTeamId);
    return item?.teamName ?? t("unassignedTeam");
  }, [drillDownTeamId, tableData, t]);

  const grandTotal = useMemo(() => {
    return tableData.reduce((sum, row) => sum + row.totalMinor, 0);
  }, [tableData]);

  const columns: ColumnDef<TeamSpendRow>[] = useMemo(
    () => [
      {
        accessorKey: "teamName",
        header: t("team"),
        enableSorting: true,
        cell: ({ getValue }) => getValue<string | null>() ?? t("unassignedTeam"),
      },
      {
        accessorKey: "contractorCount",
        header: t("contractors"),
        enableSorting: false,
      },
      {
        accessorKey: "invoiceCount",
        header: t("invoices"),
        enableSorting: true,
      },
      {
        accessorKey: "totalMinor",
        header: t("totalSpend"),
        enableSorting: true,
        cell: ({ getValue }) => formatCurrency(getValue<number>()),
      },
      {
        id: "budgetPercent",
        header: t("budgetPercent"),
        cell: () => "-",
      },
    ],
    [t],
  );

  const handleSortChange = (newSortBy: string, newSortOrder: string) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  };

  const handleDrillDown = (teamId: string) => {
    setDrillDownTeamId(teamId === drillDownTeamId ? null : teamId);
    setPage(1);
  };

  const handleClearDrillDown = () => {
    setDrillDownTeamId(null);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <ReportChart
        type="bar-horizontal"
        data={chartData}
        dataKey="totalMinor"
        nameKey="teamName"
        idKey="teamId"
        activeId={drillDownTeamId ?? undefined}
        onSegmentClick={handleDrillDown}
        isLoading={chartQuery.isLoading}
      />

      <DrillDownBreadcrumb
        segments={[
          { label: t("all") },
          ...(drillDownName ? [{ label: drillDownName, id: drillDownTeamId! }] : []),
        ]}
        onClear={handleClearDrillDown}
      />

      <ReportTable<TeamSpendRow>
        columns={columns}
        data={tableData}
        totalCount={totalCount}
        page={page}
        pageSize={20}
        onPageChange={setPage}
        onSortChange={handleSortChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        isLoading={tableQuery.isLoading}
        emptyIcon={<UsersRound className="mx-auto h-10 w-10 text-muted-foreground/50" />}
        emptyTitle={t("emptySpendTeam")}
        emptyDescription={t("emptySpendTeamBody")}
        grandTotalLabel={t("grandTotal")}
        grandTotalValue={formatCurrency(grandTotal)}
      />

      <ExportButtons
        onExportPage={() => exportMutation.mutate({ dateFrom, dateTo })}
        onExportAll={() => exportMutation.mutate({ dateFrom, dateTo })}
        isExporting={exportMutation.isPending}
      />
    </div>
  );
}
