"use client";

import { useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OverviewTab } from "./overview-tab";
import { DocumentsTab } from "./documents-tab";
import { AmendmentsTab } from "./amendments-tab";
import { ActivityTab } from "./activity-tab";

const TAB_KEYS = ["overview", "documents", "amendments", "activity"] as const;
type TabKey = (typeof TAB_KEYS)[number];

type ContractDetailTabsProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contract: any;
};

export function ContractDetailTabs({ contract }: ContractDetailTabsProps) {
  const t = useTranslations("ContractDetail");
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
      <TabsList variant="line" className="w-full justify-start">
        {TAB_KEYS.map((key) => (
          <TabsTrigger key={key} value={key}>
            {t(`tabs.${key}`)}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview" className="mt-4 min-h-[400px]">
        <OverviewTab contract={contract} />
      </TabsContent>

      <TabsContent value="documents" className="mt-4 min-h-[400px]">
        <DocumentsTab contractId={contract.id} />
      </TabsContent>

      <TabsContent value="amendments" className="mt-4 min-h-[400px]">
        <AmendmentsTab contract={contract} />
      </TabsContent>

      <TabsContent value="activity" className="mt-4 min-h-[400px]">
        <ActivityTab contract={contract} />
      </TabsContent>
    </Tabs>
  );
}
