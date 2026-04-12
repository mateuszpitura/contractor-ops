"use client";

import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { Suspense, useEffect, useState } from "react";
import { ContractorSidePanel } from "@/components/contractors/contractor-side-panel";
import type { ContractorRow } from "@/components/contractors/contractor-table/columns";
import { ContractorDataTable } from "@/components/contractors/contractor-table/data-table";
import { WizardDialog } from "@/components/contractors/contractor-wizard/wizard-dialog";
import { ImportWizardDialog } from "@/components/import/import-wizard-dialog";
import { AnimateIn } from "@/components/shared/animate-in";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/init";

/**
 * Inner contractor page content that uses nuqs (requires useSearchParams).
 * Wrapped in Suspense at the page level.
 */
function ContractorsContent() {
  const t = useTranslations("Contractors");
  const te = useTranslations("EmptyStates");

  const [selectedContractor, setSelectedContractor] = useState<ContractorRow | null>(null);
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

  // Lightweight count query for empty state detection
  const countQuery = useQuery(trpc.contractor.list.queryOptions({ page: 1, pageSize: 10 }));
  const totalCount = (countQuery.data as { total: number } | undefined)?.total ?? 0;
  const isCountLoading = countQuery.isLoading;

  const handleRowClick = (contractor: ContractorRow) => {
    setSelectedContractor(contractor);
    setSidePanelOpen(true);
  };

  const handleAddContractor = () => {
    setWizardOpen(true);
  };

  // Show empty state only when count query resolved and total is 0
  if (!isCountLoading && totalCount === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
        <EmptyState
          icon={Users}
          heading={te("contractors.heading")}
          body={te("contractors.body")}
          primaryAction={{ label: te("contractors.cta"), onClick: handleAddContractor }}
          secondaryAction={{
            label: te("contractors.secondary"),
            onClick: () => setImportWizardOpen(true),
          }}
        />
        <WizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />
        <ImportWizardDialog
          open={importWizardOpen}
          onOpenChange={setImportWizardOpen}
          defaultEntityType="contractor"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <AnimateIn delay={0}>
        <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      </AnimateIn>

      {/* Data table */}
      <AnimateIn delay={1}>
        <ContractorDataTable
          onRowClick={handleRowClick}
          onAddContractor={handleAddContractor}
          onImport={() => setImportWizardOpen(true)}
        />
      </AnimateIn>

      {/* Side panel */}
      <ContractorSidePanel
        contractor={selectedContractor}
        open={sidePanelOpen}
        onOpenChange={setSidePanelOpen}
      />

      {/* Add contractor wizard */}
      <WizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />

      {/* Import wizard */}
      <ImportWizardDialog
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
        defaultEntityType="contractor"
      />
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
            <div
              key={`skel-${i}`}
              className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0"
            >
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
