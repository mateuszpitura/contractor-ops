"use client";

import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

type TabPlaceholderProps = {
  phase: number;
  featureDescription: string;
  icon: LucideIcon;
};

export function TabPlaceholder({
  phase,
  featureDescription,
  icon: Icon,
}: TabPlaceholderProps) {
  const t = useTranslations("ContractorProfile");

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
      <Icon className="size-12 text-muted-foreground" strokeWidth={1.5} />
      <h3 className="text-base font-medium text-foreground">
        {t("placeholder.heading", { phase })}
      </h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        {featureDescription}
      </p>
    </div>
  );
}
