"use client";

import { useQuery } from "@tanstack/react-query";
import { Files, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { DocumentCard } from "@/components/documents/document-card";
import { DropZone } from "@/components/documents/drop-zone";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/init";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabDocumentsProps = {
  contractorId: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TabDocuments({ contractorId }: TabDocumentsProps) {
  const t = useTranslations("Documents");

  const documentsQuery = useQuery(
    trpc.document.list.queryOptions({
      entityType: "CONTRACTOR" as const,
      entityId: contractorId,
      page: 1,
      pageSize: 50,
    }),
  );

  // tRPC returns documents with extra relations; narrow to what components need
  const documents = (documentsQuery.data?.items ?? []) as unknown as Array<{
    id: string;
    originalFileName: string;
    mimeType: string;
    fileSizeBytes: number;
    virusScanStatus: string;
    createdAt: string | Date;
    uploadedByUserId: string | null;
    status: string;
  }>;

  // Loading state
  if (documentsQuery.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`skel-${i}`} className="flex items-start gap-4 rounded-lg border p-4">
            <Skeleton className="size-12 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (documents.length === 0) {
    return (
      <div className="space-y-6">
        {/* Drop zone always shown for easy upload */}
        <DropZone entityType="CONTRACTOR" entityId={contractorId} />

        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
          <Files className="size-10 text-muted-foreground/50" />
          <h4 className="text-sm font-medium">{t("contractorTab.emptyHeading")}</h4>
          <p className="max-w-sm text-sm text-muted-foreground">{t("contractorTab.emptyBody")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">{t("contractorTab.heading")}</h3>
      </div>

      {/* Drop zone for uploads */}
      <DropZone entityType="CONTRACTOR" entityId={contractorId} />

      {/* Document cards */}
      <div className="space-y-3">
        {documents.map((doc, i) => (
          <DocumentCard key={doc.id} document={doc} versionNumber={documents.length - i} />
        ))}
      </div>
    </div>
  );
}
