"use client";

import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

type ComplianceHealth = "green" | "yellow" | "red";

interface ComplianceHealthBadgeProps {
  health: ComplianceHealth;
  size?: "sm" | "md";
}

const healthConfig: Record<
  ComplianceHealth,
  {
    className: string;
    icon: typeof CheckCircle;
    labelKey: "green" | "yellow" | "red";
  }
> = {
  green: {
    className: "bg-green-600/10 text-green-600 dark:text-green-400",
    icon: CheckCircle,
    labelKey: "green",
  },
  yellow: {
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    icon: AlertTriangle,
    labelKey: "yellow",
  },
  red: {
    className: "bg-red-500/10 text-red-500 dark:text-red-400",
    icon: XCircle,
    labelKey: "red",
  },
};

/**
 * Compliance health badge pill with icon and translated label.
 * Renders green/yellow/red status with appropriate color and icon.
 */
export function ComplianceHealthBadge({ health, size = "sm" }: ComplianceHealthBadgeProps) {
  const t = useTranslations("Contractors.health");
  const config = healthConfig[health];
  const Icon = config.icon;

  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs gap-1" : "px-2.5 py-1 text-sm gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.className} ${sizeClasses}`}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {t(config.labelKey)}
    </span>
  );
}
