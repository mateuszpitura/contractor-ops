"use client";

import { useState, useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { FileText, Plus } from "lucide-react";

import { trpc } from "@/trpc/init";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { ContractWizardDialog } from "@/components/contracts/contract-wizard/wizard-dialog";

// ---------------------------------------------------------------------------
// Row type (subset of full ContractRow for the mini table)
// ---------------------------------------------------------------------------

type MiniContractRow = {
  id: string;
  title: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  rateValueMinor: number | null;
  currency: string;
};

// ---------------------------------------------------------------------------
// Status badge styling
// ---------------------------------------------------------------------------

const statusBadgeColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground border border-border",
  PENDING_SIGNATURE: "bg-muted text-muted-foreground border border-border",
  ACTIVE: "bg-green-500/10 text-green-600 dark:text-green-400",
  EXPIRING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  EXPIRED: "bg-red-500/10 text-red-600 dark:text-red-400",
  TERMINATED: "bg-muted text-muted-foreground border border-border",
  SUPERSEDED: "bg-muted/50 text-muted-foreground/60 border border-border/50",
  ARCHIVED: "bg-muted text-muted-foreground border border-border",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type TabContractsProps = {
  contractorId: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TabContracts({ contractorId }: TabContractsProps) {
  const t = useTranslations("Contracts");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const contractsQuery = useQuery(
    trpc.contract.list.queryOptions({
      contractorId,
      page,
      pageSize,
      sortBy: "startDate",
      sortOrder: "desc",
    })
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryData = contractsQuery.data as any;
  const items: MiniContractRow[] = queryData?.items ?? [];
  const totalCount: number = queryData?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const columns: ColumnDef<MiniContractRow>[] = useMemo(
    () => [
      {
        accessorKey: "title",
        header: t("contractorTab.columns.title" as Parameters<typeof t>[0]),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.title}</span>
        ),
      },
      {
        accessorKey: "status",
        header: t("contractorTab.columns.status" as Parameters<typeof t>[0]),
        cell: ({ row }) => (
          <Badge
            variant="secondary"
            className={statusBadgeColors[row.original.status] ?? ""}
          >
            {t(`status.${row.original.status}` as Parameters<typeof t>[0])}
          </Badge>
        ),
      },
      {
        accessorKey: "startDate",
        header: t("contractorTab.columns.startDate" as Parameters<typeof t>[0]),
        cell: ({ row }) => {
          if (!row.original.startDate) return <span className="text-muted-foreground">&mdash;</span>;
          try {
            return (
              <span className="text-sm">
                {new Date(row.original.startDate).toLocaleDateString("pl-PL")}
              </span>
            );
          } catch {
            return <span className="text-muted-foreground">&mdash;</span>;
          }
        },
      },
      {
        accessorKey: "endDate",
        header: t("contractorTab.columns.endDate" as Parameters<typeof t>[0]),
        cell: ({ row }) => {
          if (!row.original.endDate) return <span className="text-muted-foreground">&mdash;</span>;
          try {
            return (
              <span className="text-sm">
                {new Date(row.original.endDate).toLocaleDateString("pl-PL")}
              </span>
            );
          } catch {
            return <span className="text-muted-foreground">&mdash;</span>;
          }
        },
      },
      {
        accessorKey: "rateValueMinor",
        header: t("contractorTab.columns.rate" as Parameters<typeof t>[0]),
        cell: ({ row }) => {
          const minor = row.original.rateValueMinor;
          if (typeof minor !== "number")
            return <span className="text-muted-foreground">&mdash;</span>;
          const formatted = new Intl.NumberFormat("pl-PL", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(minor / 100);
          return (
            <span className="font-mono text-sm tabular-nums">
              {formatted} {row.original.currency}
            </span>
          );
        },
      },
    ],
    [t]
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  });

  // Loading state
  if (contractsQuery.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (items.length === 0 && !contractsQuery.isLoading) {
    return (
      <>
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
          <FileText className="size-10 text-muted-foreground/50" />
          <h4 className="text-sm font-medium">{t("contractorTab.emptyHeading")}</h4>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("contractorTab.emptyBody")}
          </p>
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            <Plus className="me-1.5 size-3.5" />
            {t("contractorTab.emptyCTA")}
          </Button>
        </div>
        <ContractWizardDialog
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          contractorId={contractorId}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with CTA */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">{t("contractorTab.heading")}</h3>
        <Button size="sm" onClick={() => setWizardOpen(true)}>
          <Plus className="me-1.5 size-3.5" />
          {t("contractorTab.addCTA")}
        </Button>
      </div>

      {/* Mini table */}
      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-muted/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <Link href={`/contracts/${row.original.id}`} className="contents">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Link>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Simple pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            &laquo;
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            &raquo;
          </Button>
        </div>
      )}

      {/* Wizard dialog */}
      <ContractWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        contractorId={contractorId}
      />
    </div>
  );
}
