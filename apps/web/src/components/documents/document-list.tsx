"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/init";
import { DocumentCard } from "./document-card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DocumentListProps = {
  entityType: string;
  entityId: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentList({ entityType, entityId }: DocumentListProps) {
  const t = useTranslations("Documents");

  const documentsQuery = useQuery(
    trpc.document.list.queryOptions({
      entityType: entityType as "CONTRACT" | "CONTRACTOR",
      entityId,
      page: 1,
      pageSize: 50,
    }),
  );

  // tRPC returns documents with extra relations; narrow to what DocumentCard needs
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

  if (documents.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center">
        <FileText className="size-8 text-muted-foreground/50" />
        <h4 className="text-sm font-medium text-muted-foreground">{t("empty.title")}</h4>
        <p className="max-w-sm text-sm text-muted-foreground">{t("empty.description")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc, i) => (
        <DocumentCard key={doc.id} document={doc} versionNumber={documents.length - i} />
      ))}
    </div>
  );
}
