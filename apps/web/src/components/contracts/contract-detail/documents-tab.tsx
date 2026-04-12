"use client";

import { useQuery } from "@tanstack/react-query";
import { PenLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { DocumentList } from "@/components/documents/document-list";
import { DropZone } from "@/components/documents/drop-zone";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/init";
import { SendForSignatureDialog } from "./send-for-signature-dialog";

type DocumentsTabProps = {
  contractId: string;
  /** Contract parties for signer auto-population */
  contractParties?: Array<{
    name: string;
    email: string;
    role: "signer" | "countersigner";
  }>;
};

export function DocumentsTab({ contractId, contractParties = [] }: DocumentsTabProps) {
  const _t = useTranslations("ContractDetail.documents");
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState("");

  // Check if at least one e-sign provider is connected
  const connectionsQuery = useQuery(trpc.esign.listConnections.queryOptions());
  const hasProvider = (connectionsQuery.data ?? []).length > 0;

  // Fetch documents to get their IDs for per-document signing
  const documentsQuery = useQuery(
    trpc.document.list.queryOptions({
      entityType: "CONTRACT" as "CONTRACT" | "CONTRACTOR",
      entityId: contractId,
      page: 1,
      pageSize: 50,
    }),
  );
  const documents = (documentsQuery.data?.items ?? []) as Array<{
    id: string;
    originalFileName: string;
  }>;

  function handleSendForSignature(documentId: string) {
    setSelectedDocId(documentId);
    setSignDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <DropZone entityType="CONTRACT" entityId={contractId} />

      {/* Per-document send for signature actions */}
      {hasProvider && documents.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {documents.map((doc) => (
            <Button
              key={doc.id}
              variant="outline"
              size="sm"
              onClick={() => handleSendForSignature(doc.id)}
            >
              <PenLine className="me-1.5 size-3.5" />
              Send for Signature: {doc.originalFileName}
            </Button>
          ))}
        </div>
      )}

      {/* Document list */}
      <DocumentList entityType="CONTRACT" entityId={contractId} />

      {/* Send for Signature Dialog */}
      <SendForSignatureDialog
        open={signDialogOpen}
        onOpenChange={setSignDialogOpen}
        contractId={contractId}
        documentId={selectedDocId}
        contractParties={contractParties}
      />
    </div>
  );
}
