"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
// Forward-declared tab content components (imported lazily by parent)
import type { ReactNode } from "react";
import { useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TAB_KEYS = [
  "overview",
  "contracts",
  "documents",
  "workflows",
  "invoices",
  "payments",
  "equipment",
  "activity",
  "compliance",
] as const;

type TabKey = (typeof TAB_KEYS)[number];

type ProfileTabsProps = {
  overviewContent: ReactNode;
  complianceContent: ReactNode;
  activityContent: ReactNode;
  contractsContent: ReactNode;
  documentsContent: ReactNode;
  workflowsContent: ReactNode;
  invoicesContent: ReactNode;
  paymentsContent: ReactNode;
  equipmentContent: ReactNode;
};

export function ProfileTabs({
  overviewContent,
  complianceContent,
  activityContent,
  contractsContent,
  documentsContent,
  workflowsContent,
  invoicesContent,
  paymentsContent,
  equipmentContent,
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
    [searchParams, router, pathname],
  );

  return (
    <Tabs value={currentTab} onValueChange={(value) => setTab(value as string)} className="w-full">
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
        {contractsContent}
      </TabsContent>

      <TabsContent value="documents" className="mt-4 min-h-[400px]">
        {documentsContent}
      </TabsContent>

      <TabsContent value="workflows" className="mt-4 min-h-[400px]">
        {workflowsContent}
      </TabsContent>

      <TabsContent value="invoices" className="mt-4 min-h-[400px]">
        {invoicesContent}
      </TabsContent>

      <TabsContent value="payments" className="mt-4 min-h-[400px]">
        {paymentsContent}
      </TabsContent>

      <TabsContent value="equipment" className="mt-4 min-h-[400px]">
        {equipmentContent}
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
