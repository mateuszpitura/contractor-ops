"use client";

import { useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  FileText,
  Files,
  GitBranch,
  Receipt,
  Banknote,
  Clock,
} from "lucide-react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TabPlaceholder } from "./tab-placeholder";

// Forward-declared tab content components (imported lazily by parent)
import type { ReactNode } from "react";

const TAB_KEYS = [
  "overview",
  "contracts",
  "documents",
  "workflows",
  "invoices",
  "payments",
  "activity",
  "compliance",
] as const;

type TabKey = (typeof TAB_KEYS)[number];

type ProfileTabsProps = {
  overviewContent: ReactNode;
  complianceContent: ReactNode;
  activityContent: ReactNode;
};

export function ProfileTabs({
  overviewContent,
  complianceContent,
  activityContent,
}: ProfileTabsProps) {
  const t = useTranslations("ContractorProfile");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const currentTab = (searchParams.get("tab") as TabKey) ?? "overview";

  const setTab = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  return (
    <Tabs
      value={currentTab}
      onValueChange={(value) => setTab(value as string)}
      className="w-full"
    >
      <TabsList variant="line" className="w-full justify-start overflow-x-auto">
        {TAB_KEYS.map((key) => (
          <TabsTrigger key={key} value={key}>
            {t(`tabs.${key}`)}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview" className="mt-4 min-h-[400px]">
        {overviewContent}
      </TabsContent>

      <TabsContent value="contracts" className="mt-4 min-h-[400px]">
        <TabPlaceholder
          phase={3}
          featureDescription={t("placeholder.contracts")}
          icon={FileText}
        />
      </TabsContent>

      <TabsContent value="documents" className="mt-4 min-h-[400px]">
        <TabPlaceholder
          phase={3}
          featureDescription={t("placeholder.documents")}
          icon={Files}
        />
      </TabsContent>

      <TabsContent value="workflows" className="mt-4 min-h-[400px]">
        <TabPlaceholder
          phase={4}
          featureDescription={t("placeholder.workflows")}
          icon={GitBranch}
        />
      </TabsContent>

      <TabsContent value="invoices" className="mt-4 min-h-[400px]">
        <TabPlaceholder
          phase={5}
          featureDescription={t("placeholder.invoices")}
          icon={Receipt}
        />
      </TabsContent>

      <TabsContent value="payments" className="mt-4 min-h-[400px]">
        <TabPlaceholder
          phase={8}
          featureDescription={t("placeholder.payments")}
          icon={Banknote}
        />
      </TabsContent>

      <TabsContent value="activity" className="mt-4 min-h-[400px]">
        {activityContent}
      </TabsContent>

      <TabsContent value="compliance" className="mt-4 min-h-[400px]">
        {complianceContent}
      </TabsContent>
    </Tabs>
  );
}

export type { TabKey };
