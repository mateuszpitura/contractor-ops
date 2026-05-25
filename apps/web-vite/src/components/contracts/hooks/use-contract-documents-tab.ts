import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useContractDocumentsTab(contractId: string) {
  const trpc = useTRPC();
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState('');

  const connectionsQuery = useQuery(trpc.esign.listConnections.queryOptions());
  const hasProvider = (connectionsQuery.data ?? []).length > 0;

  const documentsQuery = useQuery(
    trpc.document.list.queryOptions({
      entityType: 'CONTRACT' as 'CONTRACT' | 'CONTRACTOR',
      entityId: contractId,
      page: 1,
      pageSize: 50,
    }),
  );

  const documents = (documentsQuery.data?.items ?? []) as Array<{
    id: string;
    originalFileName: string;
  }>;

  const handleSendForSignature = (documentId: string) => {
    setSelectedDocId(documentId);
    setSignDialogOpen(true);
  };

  return {
    documents,
    handleSendForSignature,
    hasProvider,
    isLoading: connectionsQuery.isPending || documentsQuery.isPending,
    selectedDocId,
    signDialogOpen,
    setSignDialogOpen,
  } as const;
}
