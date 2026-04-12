"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import type { ImportRow } from "./import-wizard-dialog";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface StepPreviewProps {
  validRows: ImportRow[];
  invalidRows: ImportRow[];
  totalRows: number;
}

export function StepPreview({ validRows, invalidRows, totalRows }: StepPreviewProps) {
  const t = useTranslations("Import");
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  const allRows = useMemo(
    () => [...validRows, ...invalidRows].sort((a, b) => a.rowNumber - b.rowNumber),
    [validRows, invalidRows],
  );

  const displayRows = showErrorsOnly ? invalidRows : allRows;

  // Collect all data field keys from rows
  const columns = useMemo(() => {
    const keys = new Set<string>();
    for (const row of allRows) {
      for (const key of Object.keys(row.data)) {
        keys.add(key);
      }
    }
    return Array.from(keys);
  }, [allRows]);

  // Build a set of (rowNumber, field) pairs that have errors
  const errorCells = useMemo(() => {
    const set = new Set<string>();
    for (const row of invalidRows) {
      for (const err of row.errors) {
        set.add(`${row.rowNumber}:${err.field}`);
      }
    }
    return set;
  }, [invalidRows]);

  // Build error message lookup
  const errorMessages = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of invalidRows) {
      for (const err of row.errors) {
        map.set(`${row.rowNumber}:${err.field}`, err.message);
      }
    }
    return map;
  }, [invalidRows]);

  const hasNoInvalidRows = invalidRows.length === 0;

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm">
        <span className="font-semibold text-emerald-600">
          {t("preview.validRows", { count: validRows.length })}
        </span>
        <span className="font-semibold text-destructive">
          {t("preview.invalidRows", { count: invalidRows.length })}
        </span>
        <span className="text-muted-foreground">
          {t("preview.totalRows", { count: totalRows })}
        </span>
      </div>

      {/* Toggle filter */}
      {!hasNoInvalidRows && (
        <div className="flex gap-2">
          <Button
            variant={!showErrorsOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowErrorsOnly(false)}
            type="button"
          >
            {t("preview.showAll")}
          </Button>
          <Button
            variant={showErrorsOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowErrorsOnly(true)}
            type="button"
          >
            {t("preview.showErrors")}
          </Button>
        </div>
      )}

      {/* All valid message */}
      {hasNoInvalidRows && validRows.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle2 className="size-4" />
          <span>{t("preview.allValid", { count: validRows.length })}</span>
        </div>
      )}

      {/* Empty state */}
      {totalRows === 0 && (
        <div className="text-sm text-muted-foreground">{t("preview.noRows")}</div>
      )}

      {/* Data table */}
      <ScrollArea className="max-h-[360px] overflow-auto">
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                {columns.map((col) => (
                  <TableHead key={col}>{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map((row) => {
                const isInvalid = row.status === "invalid";
                return (
                  <TableRow key={row.rowNumber} className={isInvalid ? "bg-destructive/5" : ""}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.rowNumber}
                    </TableCell>
                    {columns.map((col) => {
                      const cellKey = `${row.rowNumber}:${col}`;
                      const hasError = errorCells.has(cellKey);
                      const errMsg = errorMessages.get(cellKey);

                      return (
                        <TableCell
                          key={col}
                          className={hasError ? "border-l-2 border-destructive" : ""}
                        >
                          <div className="flex items-center gap-1">
                            <span className="truncate max-w-[160px] text-sm">
                              {String(row.data[col] ?? "")}
                            </span>
                            {hasError && errMsg && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertCircle className="size-3.5 shrink-0 text-destructive" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{errMsg}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TooltipProvider>
      </ScrollArea>
    </div>
  );
}
