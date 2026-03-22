"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DollarSign } from "lucide-react";

import { trpc } from "@/trpc/init";
import { useRouter } from "@/i18n/navigation";
import { ReportChart } from "./report-chart";
import { ReportTable } from "./report-table";
import { DrillDownBreadcrumb } from "./drill-down-breadcrumb";
import { ExportButtons, downloadBase64File } from "./export-buttons";

function formatCurrency(grosze: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(grosze / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("pl-PL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

interface SpendContractorReportProps {
  dateFrom: string;
  dateTo: string;
}

type SpendRow = {
  contractorId: string;
  contractorName: string;
  invoiceCount: number;
  totalGrosze: number;
  avgGrosze: number;
  lastPaidAt: string | null;
};

export function SpendContractorReport({
  dateFrom,
  dateTo,
}: SpendContractorReportProps) {
  const t = useTranslations("Reports");
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("totalSpend");
  const [sortOrder, setSortOrder] = useState("desc");
  const [drillDownContractorId, setDrillDownContractorId] = useState<
    string | null
  >(null);

  const tableQuery = useQuery(
    trpc.report.spendByContractor.queryOptions({
      dateFrom,
      dateTo,
      page,
      pageSize: 20,
      sortBy: sortBy as "totalSpend" | "invoiceCount" | "contractorName",
      sortOrder: sortOrder as "asc" | "desc",
      contractorId: drillDownContractorId ?? undefined,
    }),
  );

  const chartQuery = useQuery(
    trpc.report.spendByContractorChart.queryOptions({ dateFrom, dateTo }),
  );

  const exportMutation = useMutation(
    trpc.report.exportSpendByContractor.mutationOptions({
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
    const result = tableQuery.data as
      | { items: SpendRow[]; totalCount: number }
      | undefined;
    return result?.items ?? [];
  }, [tableQuery.data]);

  const totalCount = useMemo(() => {
    const result = tableQuery.data as
      | { items: SpendRow[]; totalCount: number }
      | undefined;
    return result?.totalCount ?? 0;
  }, [tableQuery.data]);

  const chartData = useMemo(() => {
    return (chartQuery.data ?? []) as Array<{
      contractorId: string;
      contractorName: string;
      totalGrosze: number;
    }>;
  }, [chartQuery.data]);

  const drillDownName = useMemo(() => {
    if (!drillDownContractorId) return null;
    const item = chartData.find(
      (d) => d.contractorId === drillDownContractorId,
    );
    return item?.contractorName ?? drillDownContractorId;
  }, [drillDownContractorId, chartData]);

  const grandTotal = useMemo(() => {
    return tableData.reduce((sum, row) => sum + row.totalGrosze, 0);
  }, [tableData]);

  const columns: ColumnDef<SpendRow>[] = useMemo(
    () => [
      {
        accessorKey: "contractorName",
        header: t("contractor"),
        enableSorting: true,
      },
      {
        accessorKey: "invoiceCount",
        header: t("invoices"),
        enableSorting: true,
      },
      {
        accessorKey: "totalGrosze",
        header: t("totalSpend"),
        enableSorting: true,
        cell: ({ getValue }) => formatCurrency(getValue<number>()),
      },
      {
        accessorKey: "avgGrosze",
        header: t("avgInvoice"),
        cell: ({ getValue }) => formatCurrency(getValue<number>()),
      },
      {
        accessorKey: "lastPaidAt",
        header: t("lastPayment"),
        cell: ({ getValue }) => formatDate(getValue<string | null>()),
      },
    ],
    [t],
  );

  const handleSortChange = (newSortBy: string, newSortOrder: string) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  };

  const handleDrillDown = (contractorId: string) => {
    setDrillDownContractorId(
      contractorId === drillDownContractorId ? null : contractorId,
    );
    setPage(1);
  };

  const handleClearDrillDown = () => {
    setDrillDownContractorId(null);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <ReportChart
        type="bar-horizontal"
        data={chartData}
        dataKey="totalGrosze"
        nameKey="contractorName"
        idKey="contractorId"
        activeId={drillDownContractorId ?? undefined}
        onSegmentClick={handleDrillDown}
        isLoading={chartQuery.isLoading}
      />

      <DrillDownBreadcrumb
        segments={[
          { label: t("all") },
          ...(drillDownName
            ? [{ label: drillDownName, id: drillDownContractorId! }]
            : []),
        ]}
        onClear={handleClearDrillDown}
      />

      <ReportTable<SpendRow>
        columns={columns}
        data={tableData}
        totalCount={totalCount}
        page={page}
        pageSize={20}
        onPageChange={setPage}
        onSortChange={handleSortChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onRowClick={(row) => router.push(`/contractors/${row.contractorId}`)}
        isLoading={tableQuery.isLoading}
        emptyIcon={
          <DollarSign className="mx-auto h-10 w-10 text-muted-foreground/50" />
        }
        emptyTitle={t("emptySpendContractor")}
        emptyDescription={t("emptySpendContractorBody")}
        grandTotalLabel={t("grandTotal")}
        grandTotalValue={formatCurrency(grandTotal)}
      />

      <ExportButtons
        onExportPage={() =>
          exportMutation.mutate({
            dateFrom,
            dateTo,
            contractorId: drillDownContractorId ?? undefined,
          })
        }
        onExportAll={() =>
          exportMutation.mutate({ dateFrom, dateTo })
        }
        isExporting={exportMutation.isPending}
      />
    </div>
  );
}
