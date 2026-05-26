import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';
import type { PeppolParticipantStatus } from '../peppol-participant-status-pill.js';

export interface PeppolParticipantRow {
  id: string;
  status: PeppolParticipantStatus;
  schemeId: string;
  identifierValue: string;
  participantId: string;
  aspProvider: string | null;
  createdAt: string | Date;
  lastCapabilityCheckAt?: string | Date | null;
}

export function usePeppolParticipantCard() {
  const trpc = useTRPC();
  const t = useTranslations('EInvoice.Settings.PeppolCard');
  const tDialog = useTranslations('EInvoice.PeppolDialog');
  const tCap = useTranslations('Peppol.capabilities');
  const queryClient = useQueryClient();

  const [registerOpen, setRegisterOpen] = useState(false);
  const [deregisterOpen, setDeregisterOpen] = useState(false);

  const participantsQuery = useQuery(trpc.peppol.listParticipants.queryOptions());

  const participants = (participantsQuery.data ?? []) as PeppolParticipantRow[];
  const active = participants.find(p => p.status !== 'DEREGISTERED') ?? null;

  const lookupQuery = useQuery({
    ...trpc.peppol.lookupCapabilities.queryOptions(
      active
        ? { schemeId: active.schemeId, value: active.identifierValue, forceRefresh: true }
        : ({} as never),
    ),
    enabled: false,
  });

  const handleRecheckCapabilities = useCallback(async () => {
    if (!active) return;
    try {
      const result = await lookupQuery.refetch({ throwOnError: true });
      const data = result.data as { supportsXRechnungCii: boolean } | undefined;
      if (data?.supportsXRechnungCii) {
        toast.success(tCap('xrechnungCiiSupported'));
      } else {
        toast.warning(tCap('xrechnungCiiUnsupported'));
      }
      await queryClient.invalidateQueries({
        queryKey: trpc.peppol.listParticipants.queryKey(),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tCap('recheckFailed'));
    }
  }, [active, lookupQuery, queryClient, tCap, trpc.peppol.listParticipants]);

  return {
    t,
    tDialog,
    tCap,
    registerOpen,
    setRegisterOpen,
    deregisterOpen,
    setDeregisterOpen,
    participantsQuery,
    active,
    lookupQuery,
    handleRecheckCapabilities,
    isLoading: participantsQuery.isLoading,
  } as const;
}
