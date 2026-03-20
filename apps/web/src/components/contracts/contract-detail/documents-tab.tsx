"use client";

import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropZone } from "@/components/documents/drop-zone";
import { DocumentList } from "@/components/documents/document-list";

type DocumentsTabProps = {
  contractId: string;
};

export function DocumentsTab({ contractId }: DocumentsTabProps) {
  const t = useTranslations("ContractDetail.documents");

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <DropZone
        entityType="CONTRACT"
        entityId={contractId}
      />

      {/* Document list */}
      <DocumentList entityType="CONTRACT" entityId={contractId} />
    </div>
  );
}
