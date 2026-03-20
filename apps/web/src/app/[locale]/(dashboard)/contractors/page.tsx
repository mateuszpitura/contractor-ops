"use client";

import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { ContractorDataTable } from "@/components/contractors/contractor-table/data-table";
import { ContractorSidePanel } from "@/components/contractors/contractor-side-panel";
import { WizardDialog } from "@/components/contractors/contractor-wizard/wizard-dialog";
import type { ContractorRow } from "@/components/contractors/contractor-table/columns";

/**
 * Inner contractor page content that uses nuqs (requires useSearchParams).
 * Wrapped in Suspense at the page level.
 */
function ContractorsContent() {
  const t = useTranslations("Contractors");

  const [selectedContractor, setSelectedContractor] =
    useState<ContractorRow | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  const handleRowClick = (contractor: ContractorRow) => {
    setSelectedContractor(contractor);
    setSidePanelOpen(true);
  };

  const handleAddContractor = () => {
    setWizardOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-[20px] font-semibold">{t("pageTitle")}</h1>
      </div>

      {/* Data table */}
      <ContractorDataTable
        onRowClick={handleRowClick}
        onAddContractor={handleAddContractor}
      />

      {/* Side panel */}
      <ContractorSidePanel
        contractor={selectedContractor}
        open={sidePanelOpen}
        onOpenChange={setSidePanelOpen}
      />

      {/* Add contractor wizard */}
      <WizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}

/**
 * Fallback loading state while Suspense boundary resolves.
 */
function ContractorsLoading() {
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
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Contractor list page at /contractors.
 * Wrapped in Suspense to handle nuqs useSearchParams usage.
 */
export default function ContractorsPage() {
  return (
    <Suspense fallback={<ContractorsLoading />}>
      <ContractorsContent />
    </Suspense>
  );
}
