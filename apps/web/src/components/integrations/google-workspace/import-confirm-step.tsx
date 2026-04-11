"use client";

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// ImportConfirmStep
// ---------------------------------------------------------------------------

interface ImportConfirmStepProps {
  userCount: number;
  roleBreakdown: Array<{ role: string; count: number; source: string }>;
  onConfirm: () => void;
  onBack: () => void;
  isImporting: boolean;
}

export function ImportConfirmStep({
  userCount,
  roleBreakdown,
  onConfirm,
  onBack,
  isImporting,
}: ImportConfirmStepProps) {
  const t = useTranslations("GoogleWorkspace.import");

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 py-4">
          <h3 className="text-lg font-semibold">
            {t("readyToImport", { count: userCount })}
          </h3>

          <div className="space-y-2">
            <p className="text-sm font-medium">{t("roleBreakdown")}</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {roleBreakdown.map((item) => (
                <li key={`${item.role}-${item.source}`}>
                  {t("roleCount", { count: item.count, role: item.role })}{" "}
                  <span className="text-xs">
                    {t("roleSource", { source: item.source })}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-muted-foreground">
            {t("inviteNotice")}
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onBack} disabled={isImporting}>
          {t("back")}
        </Button>
        <Button onClick={onConfirm} disabled={isImporting}>
          {isImporting && (
            <Loader2
              className="me-1.5 size-3.5 animate-spin"
              aria-hidden="true"
            />
          )}
          {isImporting
            ? t("importing")
            : t("importCta", { count: userCount })}
        </Button>
      </div>
    </div>
  );
}
