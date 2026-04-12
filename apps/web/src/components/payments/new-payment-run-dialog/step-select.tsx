"use client";

import { useQuery } from "@tanstack/react-query";
import type { RowSelectionState } from "@tanstack/react-table";
import { CalendarIcon, FileSearch } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/trpc/init";
import type { ReadyInvoiceRow } from "../invoice-selection-table/columns";
import { getColumns } from "../invoice-selection-table/columns";
import { InvoiceSelectionDataTable } from "../invoice-selection-table/data-table";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StepSelectProps {
  selectedInvoiceIds: string[];
  onSelectionChange: (ids: string[]) => void;
  groupByCurrency: boolean;
  onGroupByCurrencyChange: (value: boolean) => void;
  onCancel: () => void;
  onNext: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepSelect({
  selectedInvoiceIds,
  onSelectionChange,
  groupByCurrency,
  onGroupByCurrencyChange,
  onCancel,
  onNext,
}: StepSelectProps) {
  const t = useTranslations("Payments");

  // Filter state
  const [currency, setCurrency] = useState<string>("all");
  const [dueDateFrom, setDueDateFrom] = useState<Date | undefined>();
  const [dueDateTo, setDueDateTo] = useState<Date | undefined>();
  const [contractorSearch, setContractorSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(contractorSearch);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [contractorSearch]);

  // Fetch invoices
  const queryInput = useMemo(
    () => ({
      currency: currency === "all" ? undefined : currency,
      dueDateFrom: dueDateFrom ?? undefined,
      dueDateTo: dueDateTo ?? undefined,
      contractorId: undefined,
      limit: 50,
    }),
    [currency, dueDateFrom, dueDateTo],
  );

  const invoicesQuery = useQuery(trpc.payment.readyForPayment.queryOptions(queryInput));

  const allInvoices = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = invoicesQuery.data as any;
    return (result?.items ?? []) as ReadyInvoiceRow[];
  }, [invoicesQuery.data]);

  // Filter by contractor search (client-side)
  const filteredInvoices = useMemo(() => {
    if (!debouncedSearch) return allInvoices;
    const lower = debouncedSearch.toLowerCase();
    return allInvoices.filter(
      (inv) => inv.contractor?.legalName?.toLowerCase().includes(lower) ?? false,
    );
  }, [allInvoices, debouncedSearch]);

  // Row selection state
  const rowSelection = useMemo(() => {
    const state: RowSelectionState = {};
    for (const id of selectedInvoiceIds) {
      state[id] = true;
    }
    return state;
  }, [selectedInvoiceIds]);

  const handleRowSelectionChange = useCallback(
    (selection: RowSelectionState) => {
      onSelectionChange(
        Object.entries(selection)
          .filter(([, v]) => v)
          .map(([k]) => k),
      );
    },
    [onSelectionChange],
  );

  // Select all matching
  const handleSelectAllMatching = useCallback(() => {
    const ids = filteredInvoices.filter((inv) => !inv._inRunNumber).map((inv) => inv.id);
    onSelectionChange(ids);
  }, [filteredInvoices, onSelectionChange]);

  // Column definitions
  const columns = useMemo(
    () => getColumns((key: string) => t(key as Parameters<typeof t>[0])),
    [t],
  );

  // Selection summary
  const selectedInvoices = useMemo(
    () => allInvoices.filter((inv) => selectedInvoiceIds.includes(inv.id)),
    [allInvoices, selectedInvoiceIds],
  );

  const selectionSummary = useMemo(() => {
    const byCurrency: Record<string, number> = {};
    for (const inv of selectedInvoices) {
      byCurrency[inv.currency] = (byCurrency[inv.currency] ?? 0) + inv.amountToPayMinor;
    }
    return byCurrency;
  }, [selectedInvoices]);

  const uniqueCurrencies = Object.keys(selectionSummary);
  const isLoading = invoicesQuery.isLoading;
  const isEmpty = !isLoading && filteredInvoices.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={currency} onValueChange={(v) => setCurrency(v ?? "all")}>
          <SelectTrigger className="w-[160px] h-8">
            <SelectValue placeholder={t("step1.allCurrencies")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("step1.allCurrencies")}</SelectItem>
            <SelectItem value="PLN">PLN</SelectItem>
            <SelectItem value="EUR">EUR</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger render={<Button variant="outline" size="sm" className="h-8 gap-1.5" />}>
            <CalendarIcon className="h-3.5 w-3.5" />
            <span className="text-xs">
              {dueDateFrom
                ? `${dueDateFrom.toLocaleDateString("pl-PL")}${dueDateTo ? ` - ${dueDateTo.toLocaleDateString("pl-PL")}` : ""}`
                : t("step1.dueDate")}
            </span>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex gap-2 p-3">
              <div>
                <p className="text-xs font-medium mb-2 text-muted-foreground">From</p>
                <Calendar
                  mode="single"
                  selected={dueDateFrom}
                  onSelect={setDueDateFrom}
                  initialFocus
                />
              </div>
              <div>
                <p className="text-xs font-medium mb-2 text-muted-foreground">To</p>
                <Calendar mode="single" selected={dueDateTo} onSelect={setDueDateTo} />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Input
          placeholder={t("step1.searchContractors")}
          value={contractorSearch}
          onChange={(e) => setContractorSearch(e.target.value)}
          className="h-8 w-[200px] text-xs"
        />
      </div>

      {/* Select all matching */}
      {!isEmpty && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={handleSelectAllMatching}
          >
            {t("step1.selectAllMatching")} ({filteredInvoices.filter((i) => !i._inRunNumber).length}
            )
          </button>
        </div>
      )}

      {/* Table or empty state */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-12">
          <FileSearch className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-[16px] font-medium">{t("step1.noInvoicesHeading")}</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            {t("step1.noInvoicesBody")}
          </p>
        </div>
      ) : (
        <InvoiceSelectionDataTable
          data={filteredInvoices}
          columns={columns}
          isLoading={isLoading}
          rowSelection={rowSelection}
          onRowSelectionChange={handleRowSelectionChange}
        />
      )}

      {/* Footer */}
      <div className="flex items-start justify-between border-t pt-4">
        <div className="space-y-1">
          {/* Selection summary */}
          <p className="text-sm text-muted-foreground">
            {selectedInvoiceIds.length > 0
              ? uniqueCurrencies.map((curr) => (
                  <span key={curr} className="block">
                    {selectedInvoices.filter((i) => i.currency === curr).length}{" "}
                    {t("step1.invoicesSelected")} &mdash;{" "}
                    {new Intl.NumberFormat("pl-PL", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format((selectionSummary[curr] ?? 0) / 100)}{" "}
                    {curr}
                  </span>
                ))
              : t("step1.noSelection")}
          </p>

          {/* Group by currency toggle */}
          {uniqueCurrencies.length > 1 && (
            <div className="flex items-center gap-2 mt-2">
              <Switch
                checked={groupByCurrency}
                onCheckedChange={onGroupByCurrencyChange}
                id="group-by-currency"
              />
              <Label htmlFor="group-by-currency" className="text-xs">
                {t("step1.groupByCurrency")}
                {groupByCurrency && uniqueCurrencies.length > 1 && (
                  <span className="ms-1 text-muted-foreground">
                    ({t("step1.willCreateRuns", { count: uniqueCurrencies.length })})
                  </span>
                )}
              </Label>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {t("step1.cancel")}
          </Button>
          <Button onClick={onNext} disabled={selectedInvoiceIds.length === 0}>
            {t("step1.reviewSelection")}
          </Button>
        </div>
      </div>
    </div>
  );
}
