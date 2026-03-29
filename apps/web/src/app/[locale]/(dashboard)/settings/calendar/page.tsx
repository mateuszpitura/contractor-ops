"use client";

import { MyCalendarSection } from "@/components/settings/my-calendar-section";
import { useTranslations } from "next-intl";

export default function CalendarSettingsPage() {
  const t = useTranslations("CalendarSettings");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">{t("pageTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("pageDescription")}
        </p>
      </div>
      <MyCalendarSection />
    </div>
  );
}
