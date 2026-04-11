"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { maskTaxId, canViewSensitivePii } from "@/lib/mask-pii";
import { ComplianceHealthBadge } from "./compliance-health-badge";
import type { ContractorRow } from "./contractor-table/columns";

// ---------------------------------------------------------------------------
// Lifecycle badge colors (same as columns.tsx)
// ---------------------------------------------------------------------------

const lifecycleBadgeColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground border border-border",
  ONBOARDING: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  ACTIVE: "bg-green-500/10 text-green-600 dark:text-green-400",
  OFFBOARDING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  ENDED: "bg-muted text-muted-foreground border border-border",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ContractorSidePanelProps {
  contractor: ContractorRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Slide-out side panel showing contractor summary.
 * Opens from right on row click. 480px on desktop, 400px on tablet.
 */
export function ContractorSidePanel({
  contractor,
  open,
  onOpenChange,
}: ContractorSidePanelProps) {
  const t = useTranslations("Contractors");
  const ts = useTranslations("Contractors.sidePanel");
  const { role } = usePermissions();
  const showPii = canViewSensitivePii(role);

  if (!contractor) return null;

  const custom = contractor.customFieldsJson as Record<string, unknown> | null;
  const billingModel = custom?.billingModel
    ? String(custom.billingModel)
    : null;
  const rateMinor = typeof custom?.rateValueMinor === "number"
    ? custom.rateValueMinor
    : null;

  const rateDisplay =
    rateMinor !== null
      ? new Intl.NumberFormat("pl-PL", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(rateMinor / 100)
      : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[480px] p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            {/* Header */}
            <SheetHeader className="space-y-3">
              <SheetTitle className="text-[20px] font-semibold leading-[1.2]">
                {contractor.displayName ?? contractor.legalName}
              </SheetTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="secondary"
                  className={
                    lifecycleBadgeColors[contractor.lifecycleStage] ?? ""
                  }
                >
                  {t(
                    `lifecycle.${contractor.lifecycleStage}` as Parameters<
                      typeof t
                    >[0],
                  )}
                </Badge>
                <Badge variant="secondary">
                  {t(`type.${contractor.type}` as Parameters<typeof t>[0])}
                </Badge>
                <ComplianceHealthBadge health={contractor.complianceHealth} />
              </div>
            </SheetHeader>

            <Separator />

            {/* Details card */}
            <div className="space-y-3">
              <h3 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">
                {ts("details")}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailItem
                  label="NIP"
                  value={showPii ? contractor.taxId : maskTaxId(contractor.taxId)}
                  mono
                />
                <DetailItem
                  label="Email"
                  value={contractor.email}
                />
                <DetailItem
                  label={t("columns.billingModel")}
                  value={billingModel}
                />
                <DetailItem
                  label={t("columns.rate")}
                  value={
                    rateDisplay
                      ? `${rateDisplay} ${contractor.currency}`
                      : null
                  }
                  mono
                />
                <DetailItem
                  label={t("columns.owner")}
                  value={contractor.owner?.name}
                />
                <DetailItem
                  label={t("columns.teamProject")}
                  value={contractor.primaryTeam?.name}
                />
              </div>
            </div>

            <Separator />

            {/* Open full profile CTA */}
            <Button
              render={
                <Link href={`/contractors/${contractor.id}`} />
              }
              className="w-full"
            >
              {ts("openFullProfile")}
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Detail item
// ---------------------------------------------------------------------------

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-[13px]" : ""}>
        {value ?? <span className="text-muted-foreground">&mdash;</span>}
      </dd>
    </div>
  );
}
