"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropZone } from "@/components/documents/drop-zone";
import { DocumentCard } from "@/components/documents/document-card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskAttachmentsProps {
  runId: string;
  taskRunId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskAttachments({ taskRunId }: TaskAttachmentsProps) {
  const t = useTranslations("Workflows");
  const [showDropZone, setShowDropZone] = useState(false);

  const docsQuery = useQuery(
    trpc.document.list.queryOptions({
      entityType: "WORKFLOW_TASK_RUN" as "CONTRACT" | "CONTRACTOR",
      entityId: taskRunId,
      page: 1,
      pageSize: 50,
    }),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const documents = ((docsQuery.data as any)?.items ?? []) as any[];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{t("attachmentsHeading")}</h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDropZone((prev) => !prev)}
        >
          {t("addAttachment")}
        </Button>
      </div>

      {/* Document list */}
      {docsQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : documents.length === 0 && !showDropZone ? (
        <p className="text-sm text-muted-foreground">{t("noAttachments")}</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <DocumentCard key={doc.id} document={doc} />
          ))}
        </div>
      )}

      {/* Upload drop zone */}
      {showDropZone && (
        <DropZone
          entityType="WORKFLOW_TASK_RUN"
          entityId={taskRunId}
        />
      )}
    </div>
  );
}
