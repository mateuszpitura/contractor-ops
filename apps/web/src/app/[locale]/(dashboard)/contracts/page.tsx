"use client";

import { Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";

import { parseAsString, useQueryState } from "nuqs";

import { trpc } from "@/trpc/init";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ContractDataTable } from "@/components/contracts/contract-table/data-table";
import { ContractSidePanel } from "@/components/contracts/contract-side-panel";
import { ContractWizardDialog } from "@/components/contracts/contract-wizard/wizard-dialog";
import { ImportWizardDialog } from "@/components/import/import-wizard-dialog";
import type { ContractRow } from "@/components/contracts/contract-table/columns";

/**
 * Inner contract page content that uses nuqs (requires useSearchParams).
 * Wrapped in Suspense at the page level.
 */
function ContractsContent() {
  const t = useTranslations("Contracts");
  const te = useTranslations("EmptyStates");

  const [selectedContract, setSelectedContract] =
    useState<ContractRow | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [action, setAction] = useQueryState("action", parseAsString);

  useEffect(() => {
    if (action === "new") {
      setWizardOpen(true);
      void setAction(null);
    }
  }, [action, setAction]);

  // Check contract and contractor counts for empty state
  const contractCountQuery = useQuery(
    trpc.contract.list.queryOptions({ page: 1, pageSize: 1 }),
  );
  const contractorCountQuery = useQuery(
    trpc.contractor.list.queryOptions({ page: 1, pageSize: 1 }),
  );
  const contractTotal = (contractCountQuery.data as { total: number } | undefined)?.total ?? 0;
  const contractorCount = (contractorCountQuery.data as { total: number } | undefined)?.total ?? 0;
  const isCountLoading = contractCountQuery.isLoading;

  const handleRowClick = (contract: ContractRow) => {
    setSelectedContract(contract);
    setSidePanelOpen(true);
  };

  const handleNewContract = () => {
    setWizardOpen(true);
  };

  // Show empty state when no contracts exist
  if (!isCountLoading && contractTotal === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[20px] font-semibold">{t("pageTitle")}</h1>
        </div>
        <EmptyState
          icon={FileText}
          heading={te("contracts.heading")}
          body={te("contracts.body")}
          primaryAction={{ label: te("contracts.cta"), onClick: handleNewContract }}
          prerequisiteMissing={contractorCount === 0}
          prerequisiteAction={{ label: te("prerequisite.cta"), href: "/contractors" }}
        />
        <ContractWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />
      </div>
    );
  }

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
        onImport={() => setImportWizardOpen(true)}
      />

      {/* Side panel */}
      <ContractSidePanel
        contract={selectedContract}
        open={sidePanelOpen}
        onOpenChange={setSidePanelOpen}
      />

      {/* Contract wizard */}
      <ContractWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />

      {/* Import wizard */}
      <ImportWizardDialog
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
        defaultEntityType="contract"
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
