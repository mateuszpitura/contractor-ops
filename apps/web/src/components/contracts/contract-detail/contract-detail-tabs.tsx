"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { trpc } from "@/trpc/init";
import { ActivityTab } from "./activity-tab";
import { AmendmentsTab } from "./amendments-tab";
import { DocumentsTab } from "./documents-tab";
import { OverviewTab } from "./overview-tab";

const TAB_KEYS = ["overview", "documents", "amendments", "activity"] as const;
type TabKey = (typeof TAB_KEYS)[number];

/** Contract detail type derived from the tRPC router (contract.getById). */
type ContractDetail = NonNullable<
  Awaited<ReturnType<ReturnType<typeof trpc.contract.getById.queryOptions>["queryFn"]>>
>;

type ContractDetailTabsProps = {
  contract: ContractDetail;
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
    [searchParams, router, pathname],
  );

  return (
    <Tabs value={currentTab} onValueChange={(value) => setTab(value as string)} className="w-full">
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
        <DocumentsTab
          contractId={contract.id}
          contractParties={
            contract.contractor
              ? [
                  {
                    name: contract.contractor.displayName,
                    email: contract.contractor.email ?? "",
                    role: "signer" as const,
                  },
                ]
              : []
          }
        />
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
