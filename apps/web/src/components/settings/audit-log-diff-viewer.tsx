"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditLogDiffViewerProps {
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a two-column before/after diff view for audit log entries.
 * Shows only fields that have changed between old and new values.
 */
export function AuditLogDiffViewer({
  oldValues,
  newValues,
}: AuditLogDiffViewerProps) {
  const t = useTranslations("Settings.auditLog");

  const changedFields = useMemo(() => {
    if (!oldValues && !newValues) return [];

    const allKeys = new Set<string>([
      ...Object.keys(oldValues ?? {}),
      ...Object.keys(newValues ?? {}),
    ]);

    return Array.from(allKeys).filter((key) => {
      const oldVal = oldValues?.[key];
      const newVal = newValues?.[key];
      return JSON.stringify(oldVal) !== JSON.stringify(newVal);
    });
  }, [oldValues, newValues]);

  if (!oldValues && !newValues) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {t("noChanges")}
      </p>
    );
  }

  if (changedFields.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {t("noChanges")}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 border-l border-primary/20 p-4">
      {/* Before column */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground">
          {t("before")}
        </h4>
        {changedFields.map((key) => (
          <div key={key} className="text-sm">
            <span className="text-muted-foreground">{key}: </span>
            <span className="text-destructive/50 line-through">
              {formatValue(oldValues?.[key])}
            </span>
          </div>
        ))}
      </div>

      {/* After column */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground">
          {t("after")}
        </h4>
        {changedFields.map((key) => (
          <div key={key} className="text-sm">
            <span className="text-muted-foreground">{key}: </span>
            <span className="text-green-600 dark:text-green-400">
              {formatValue(newValues?.[key])}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
