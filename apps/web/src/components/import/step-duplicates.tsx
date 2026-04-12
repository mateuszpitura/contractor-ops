"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { usePermissions } from "@/hooks/use-permissions";
import { canViewSensitivePii, maskTaxId } from "@/lib/mask-pii";
import type { ImportRow } from "./import-wizard-dialog";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface StepDuplicatesProps {
  duplicateRows: ImportRow[];
  duplicateActions: Record<string, "skip" | "update" | "create">;
  onActionsChange: (actions: Record<string, "skip" | "update" | "create">) => void;
}

export function StepDuplicates({
  duplicateRows,
  duplicateActions,
  onActionsChange,
}: StepDuplicatesProps) {
  const t = useTranslations("Import");
  const { role } = usePermissions();
  const showPii = canViewSensitivePii(role);

  const getAction = (rowNumber: number): "skip" | "update" | "create" => {
    return duplicateActions[String(rowNumber)] ?? "skip";
  };

  const handleActionChange = (rowNumber: number, action: "skip" | "update" | "create") => {
    onActionsChange({
      ...duplicateActions,
      [String(rowNumber)]: action,
    });
  };

  const handleBulkAction = (action: "skip" | "update") => {
    const newActions: Record<string, "skip" | "update" | "create"> = {};
    for (const row of duplicateRows) {
      newActions[String(row.rowNumber)] = action;
    }
    onActionsChange(newActions);
  };

  return (
    <div className="space-y-4">
      {/* Warning banner */}
      <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
        <AlertTriangle className="size-5 shrink-0 text-amber-500" />
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {t("duplicates.banner", { count: duplicateRows.length })}
        </p>
      </div>

      {/* Bulk action buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => handleBulkAction("skip")} type="button">
          {t("duplicates.skipAll")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleBulkAction("update")}
          type="button"
        >
          {t("duplicates.updateAll")}
        </Button>
      </div>

      {/* Duplicates table */}
      <ScrollArea className="max-h-[320px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("duplicates.taxId")}</TableHead>
              <TableHead>{t("duplicates.nameFromFile")}</TableHead>
              <TableHead>{t("duplicates.nameExisting")}</TableHead>
              <TableHead>{t("duplicates.action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {duplicateRows.map((row) => {
              const taxId = String(row.data.taxId ?? row.data.contractorTaxId ?? "");
              const name = String(row.data.legalName ?? row.data.title ?? "");
              const existingName = row.duplicateOf ?? "-";
              const action = getAction(row.rowNumber);

              return (
                <TableRow key={row.rowNumber}>
                  <TableCell className="font-mono text-sm">
                    {showPii ? taxId : maskTaxId(taxId)}
                  </TableCell>
                  <TableCell className="text-sm">{name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{existingName}</TableCell>
                  <TableCell>
                    <RadioGroup
                      value={action}
                      onValueChange={(val) =>
                        handleActionChange(row.rowNumber, val as "skip" | "update" | "create")
                      }
                      className="flex gap-3"
                    >
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                        <RadioGroupItem value="skip" />
                        {t("duplicates.skip")}
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                        <RadioGroupItem value="update" />
                        {t("duplicates.update")}
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                        <RadioGroupItem value="create" />
                        {t("duplicates.create")}
                      </label>
                    </RadioGroup>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
