import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

type Signer = {
  id: string;
  name: string;
  email: string;
  role: 'signer' | 'countersigner';
};

type ContractParty = {
  name: string;
  email: string;
  role: 'signer' | 'countersigner';
};

function buildSignersFromParties(parties: ContractParty[]): Signer[] {
  return parties.map((p, i) => ({
    id: `signer-${i}`,
    name: p.name,
    email: p.email,
    role: p.role,
  }));
}

export function useSendForSignatureDialog(
  open: boolean,
  onOpenChange: (open: boolean) => void,
  contractId: string | undefined,
  documentId: string,
  contractParties: ContractParty[],
) {
  const queryClient = useQueryClient();
  const tToast = useTranslations('ContractDetail.signing.toast');
  const trpc = useTRPC();

  const connectionsQuery = useQuery(trpc.esign.listConnections.queryOptions());
  const esignConnections = (connectionsQuery.data ?? []) as Array<{
    id: string;
    provider: string;
    status: string;
    displayName: string | null;
  }>;

  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const selectedConnection = esignConnections.find(c => c.id === selectedConnectionId);

  const [signers, setSigners] = useState<Signer[]>(() => buildSignersFromParties(contractParties));
  const [message, setMessage] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('14');
  const [reminderInterval, setReminderInterval] = useState('7');

  const resetForm = useCallback(() => {
    setSelectedConnectionId('');
    setMessage('');
    setExpiresInDays('14');
    setReminderInterval('7');
    setSigners(buildSignersFromParties(contractParties));
  }, [contractParties]);

  const sendMutation = useMutation(
    trpc.esign.sendForSignature.mutationOptions({
      onSuccess: () => {
        toast.success(tToast('sentForSignature'));
        queryClient.invalidateQueries({
          queryKey: trpc.esign.listEnvelopes.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.contract.getById.queryKey(),
        });
        onOpenChange(false);
        resetForm();
      },
      onError: () => {
        toast.error(tToast('sendFailed'));
      },
    }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSigners(prev => {
        const oldIndex = prev.findIndex(s => s.id === active.id);
        const newIndex = prev.findIndex(s => s.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const addCountersigner = useCallback(() => {
    setSigners(prev => [
      ...prev,
      {
        id: `signer-${Date.now()}`,
        name: '',
        email: '',
        role: 'countersigner',
      },
    ]);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!selectedConnection || signers.length === 0 || !documentId) return;

    sendMutation.mutate({
      contractId,
      documentId,
      connectionId: selectedConnection.id,
      provider: selectedConnection.provider as 'DOCUSIGN' | 'AUTENTI',
      signers: signers.map((s, i) => ({
        name: s.name,
        email: s.email,
        role: s.role,
        routingOrder: i + 1,
      })),
      message: message || undefined,
      expiresInDays: parseInt(expiresInDays, 10),
      reminderIntervalDays: reminderInterval === 'none' ? null : parseInt(reminderInterval, 10),
    });
  }, [
    contractId,
    documentId,
    expiresInDays,
    message,
    reminderInterval,
    selectedConnection,
    sendMutation,
    signers,
  ]);

  const handleDiscard = useCallback(() => {
    onOpenChange(false);
    resetForm();
  }, [onOpenChange, resetForm]);

  return {
    addCountersigner,
    connectionsLoading: connectionsQuery.isPending,
    esignConnections,
    expiresInDays,
    handleDiscard,
    handleDragEnd,
    handleSubmit,
    isSendPending: sendMutation.isPending,
    message,
    reminderInterval,
    selectedConnectionId,
    setExpiresInDays,
    setMessage,
    setReminderInterval,
    setSelectedConnectionId,
    signers,
  } as const;
}
