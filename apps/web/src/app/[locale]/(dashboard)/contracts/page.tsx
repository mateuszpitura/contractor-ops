"use client";

import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { ContractDataTable } from "@/components/contracts/contract-table/data-table";
import { ContractSidePanel } from "@/components/contracts/contract-side-panel";
import type { ContractRow } from "@/components/contracts/contract-table/columns";

/**
 * Inner contract page content that uses nuqs (requires useSearchParams).
 * Wrapped in Suspense at the page level.
 */
function ContractsContent() {
  const t = useTranslations("Contracts");

  const [selectedContract, setSelectedContract] =
    useState<ContractRow | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [_wizardOpen, setWizardOpen] = useState(false);

  const handleRowClick = (contract: ContractRow) => {
    setSelectedContract(contract);
    setSidePanelOpen(true);
  };

  const handleNewContract = () => {
    setWizardOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-[20px] font-semibold">{t("pageTitle")}</h1>
      </div>

      {/* Data table */}
      <ContractDataTable
        onRowClick={handleRowClick}
        onNewContract={handleNewContract}
      />

      {/* Side panel */}
      <ContractSidePanel
        contract={selectedContract}
        open={sidePanelOpen}
        onOpenChange={setSidePanelOpen}
      />
    </div>
  );
}

/**
 * Fallback loading state while Suspense boundary resolves.
 */
function ContractsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-40" />
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-80" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="rounded-xl border bg-background">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Contract list page at /contracts.
 * Wrapped in Suspense to handle nuqs useSearchParams usage.
 */
export default function ContractsPage() {
  return (
    <Suspense fallback={<ContractsLoading />}>
      <ContractsContent />
    </Suspense>
  );
}
