"use client";

import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

type ComplianceItem = {
  id: string;
  name: string;
  documentType: string | null;
  status: string;
  dueDate: string | Date | null;
  expiresAt: string | Date | null;
  requirementTemplateId: string | null;
  contract: { id: string; title: string | null } | null;
};

type TabComplianceProps = {
  contractor: {
    complianceItems: ComplianceItem[];
  };
};

const statusBadgeStyles: Record<string, string> = {
  SATISFIED: "bg-green-600/10 text-green-600",
  MISSING: "bg-red-500/10 text-red-500",
  EXPIRED: "bg-red-500/10 text-red-500",
  PENDING: "bg-amber-500/10 text-amber-600",
  WAIVED: "bg-muted text-muted-foreground",
};

function isExpiringSoon(expiresAt: string | Date | null): boolean {
  if (!expiresAt) return false;
  const d = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const thirtyDaysFromNow = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  );
  return d <= thirtyDaysFromNow && d >= new Date();
}

function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function TabCompliance({ contractor }: TabComplianceProps) {
  const t = useTranslations("ContractorProfile.compliance");

  if (contractor.complianceItems.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("noRequirements")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-medium">{t("requiredDocuments")}</h3>

      <div className="divide-y rounded-xl border bg-card">
        {contractor.complianceItems.map((item) => {
          const isMissing = item.status === "MISSING";
          const expiringSoon = isExpiringSoon(item.expiresAt);
          const statusKey = item.status as keyof typeof statusBadgeStyles;

          return (
            <div
              key={item.id}
              className={`flex items-center justify-between gap-4 px-4 py-3 ${
                isMissing ? "bg-red-50 dark:bg-red-950/20" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.name}</span>
                  {item.documentType && (
                    <span className="text-xs text-muted-foreground">
                      ({item.documentType})
                    </span>
                  )}
                </div>
                {item.expiresAt && (
                  <div className="mt-0.5 flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">
                      {t("expires")}: {formatDate(item.expiresAt)}
                    </span>
                    {expiringSoon && (
                      <span className="text-xs font-medium text-amber-600">
                        {t("expiringSoon")}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Badge
                  variant="secondary"
                  className={statusBadgeStyles[statusKey] ?? ""}
                >
                  {t(
                    `status.${statusKey}` as
                      | "status.SATISFIED"
                      | "status.MISSING"
                      | "status.EXPIRED"
                      | "status.PENDING"
                      | "status.WAIVED"
                  )}
                </Badge>

                {isMissing && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger
                        render={(props) => (
                          <Button {...props} variant="outline" size="sm" disabled>
                            <Upload className="mr-1.5 size-3.5" />
                            {t("upload")}
                          </Button>
                        )}
                      />
                      <TooltipContent>Coming in Phase 3</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
