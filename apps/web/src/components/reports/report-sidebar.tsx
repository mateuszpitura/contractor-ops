"use client";

import {
  Users,
  UsersRound,
  FileWarning,
  Clock,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

const REPORT_TYPES: Array<{
  id: string;
  icon: LucideIcon;
  labelKey: string;
}> = [
  { id: "spend-contractor", icon: Users, labelKey: "spendByContractor" },
  { id: "spend-team", icon: UsersRound, labelKey: "spendByTeam" },
  { id: "expiring-contracts", icon: FileWarning, labelKey: "expiringContracts" },
  { id: "overdue-invoices", icon: Clock, labelKey: "overdueInvoices" },
  { id: "compliance-gaps", icon: ShieldAlert, labelKey: "complianceGaps" },
];

interface ReportSidebarProps {
  activeReport: string;
  onSelect: (report: string) => void;
}

export function ReportSidebar({ activeReport, onSelect }: ReportSidebarProps) {
  const t = useTranslations("Reports");

  return (
    <>
      {/* Desktop: vertical sidebar */}
      <nav className="hidden w-[220px] shrink-0 lg:block">
        <ul className="space-y-0.5">
          {REPORT_TYPES.map((report) => {
            const Icon = report.icon;
            const isActive = activeReport === report.id;

            return (
              <li key={report.id}>
                <button
                  type="button"
                  onClick={() => onSelect(report.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "border-l-[3px] border-primary bg-primary/5 text-primary"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {t(report.labelKey as Parameters<typeof t>[0])}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobile: horizontal scrollable pill bar */}
      <nav className="lg:hidden">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {REPORT_TYPES.map((report) => {
            const Icon = report.icon;
            const isActive = activeReport === report.id;

            return (
              <button
                key={report.id}
                type="button"
                onClick={() => onSelect(report.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t(report.labelKey as Parameters<typeof t>[0])}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
