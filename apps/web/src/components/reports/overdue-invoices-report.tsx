"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "@/i18n/navigation";
import { trpc } from "@/trpc/init";
import { downloadBase64File, ExportButtons } from "./export-buttons";
import { ReportTable } from "./report-table";

function formatCurrency(minor: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

interface OverdueInvoicesReportProps {
  dateFrom: string;
  dateTo: string;
}

type OverdueRow = {
  invoiceId: string;
  invoiceNumber: string;
  contractorId: string | null;
  contractorName: string;
  amountMinor: number;
  currency: string;
  dueDate: string;
  daysOverdue: number;
  status: string;
};

export function OverdueInvoicesReport({
  dateFrom: _dateFrom,
  dateTo: _dateTo,
}: OverdueInvoicesReportProps) {
  const t = useTranslations("Reports");
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("dueDate");
  const [sortOrder, setSortOrder] = useState("asc");

  const tableQuery = useQuery(
    trpc.report.overdueInvoices.queryOptions({
      page,
      pageSize: 20,
      sortBy: sortBy as "dueDate" | "amount" | "contractorName",
      sortOrder: sortOrder as "asc" | "desc",
    }),
  );

  const exportMutation = useMutation(
    trpc.report.exportOverdueInvoices.mutationOptions({
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
    const result = tableQuery.data as { items: OverdueRow[]; totalCount: number } | undefined;
    return result?.items ?? [];
  }, [tableQuery.data]);

  const totalCount = useMemo(() => {
    const result = tableQuery.data as { items: OverdueRow[]; totalCount: number } | undefined;
    return result?.totalCount ?? 0;
  }, [tableQuery.data]);

  const columns: ColumnDef<OverdueRow>[] = useMemo(
    () => [
      {
        accessorKey: "invoiceNumber",
        header: t("invoiceNumber"),
        enableSorting: false,
      },
      {
        accessorKey: "contractorName",
        header: t("contractor"),
        enableSorting: true,
      },
      {
        accessorKey: "amountMinor",
        header: t("amount"),
        enableSorting: true,
        cell: ({ row }) => `${formatCurrency(row.original.amountMinor)} ${row.original.currency}`,
      },
      {
        accessorKey: "dueDate",
        header: t("dueDate"),
        enableSorting: true,
        cell: ({ getValue }) => formatDate(getValue<string>()),
      },
      {
        accessorKey: "daysOverdue",
        header: t("daysOverdue"),
        cell: ({ getValue }) => {
          const days = getValue<number>();
          return <span className={days > 30 ? "font-medium text-destructive" : ""}>{days}</span>;
        },
      },
      {
        accessorKey: "status",
        header: t("status"),
        cell: ({ getValue }) => <Badge variant="secondary">{getValue<string>()}</Badge>,
      },
    ],
    [t],
  );

  const handleSortChange = (newSortBy: string, newSortOrder: string) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* No chart for overdue invoices - table-only report */}
      <ReportTable<OverdueRow>
        columns={columns}
        data={tableData}
        totalCount={totalCount}
        page={page}
        pageSize={20}
        onPageChange={setPage}
        onSortChange={handleSortChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onRowClick={(row) => router.push(`/invoices/${row.invoiceId}`)}
        isLoading={tableQuery.isLoading}
        emptyIcon={<Clock className="mx-auto h-10 w-10 text-muted-foreground/50" />}
        emptyTitle={t("emptyOverdueInvoices")}
        emptyDescription={t("emptyOverdueInvoicesBody")}
      />

      <ExportButtons
        onExportPage={() => exportMutation.mutate()}
        onExportAll={() => exportMutation.mutate()}
        isExporting={exportMutation.isPending}
      />
    </div>
  );
}
