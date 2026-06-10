import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export interface PendingMergeRow {
  id: string;
  source: 'JIRA' | 'LINEAR' | 'MANUAL';
  externalId: string;
  incomingName: string;
  candidateProjectIds: string[];
}

interface CandidateInfo {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  source: 'JIRA' | 'LINEAR' | 'MANUAL';
}

export function usePendingMergesInbox() {
  const trpc = useTRPC();
  const toasts = useCommonToasts();
  const pendingQuery = useQuery(trpc.organizationDefinitions.project.pendingMerges.queryOptions());
  const [activeMerge, setActiveMerge] = useState<PendingMergeRow | null>(null);
  const [chosenTarget, setChosenTarget] = useState<string>('');

  const resolveMutation = useResourceMutation(
    trpc.organizationDefinitions.project.resolveMerge.mutationOptions({
      onSuccess: () => {
        setActiveMerge(null);
        setChosenTarget('');
      },
    }),
    {
      invalidate: [
        trpc.organizationDefinitions.project.pendingMerges.queryKey(),
        trpc.organizationDefinitions.project.list.queryKey(),
      ],
      successMessage: toasts.mergeResolved(),
    },
  );

  const items = pendingQuery.data?.items ?? [];
  const candidates: Record<string, CandidateInfo> = {};
  for (const c of (pendingQuery.data?.candidates ?? []) as CandidateInfo[]) {
    candidates[c.id] = c;
  }

  const openMerge = (row: PendingMergeRow) => {
    setActiveMerge(row);
    setChosenTarget(row.candidateProjectIds[0] ?? '');
  };

  const closeMerge = () => {
    setActiveMerge(null);
  };

  const keepSeparate = () => {
    if (!activeMerge) return;
    resolveMutation.mutate({
      pendingMergeId: activeMerge.id,
      action: 'keep',
    });
  };

  const mergeIntoExisting = () => {
    if (!activeMerge) return;
    resolveMutation.mutate({
      pendingMergeId: activeMerge.id,
      action: 'merge',
      mergeIntoProjectId: chosenTarget,
    });
  };

  return {
    items,
    candidates,
    activeMerge,
    chosenTarget,
    setChosenTarget,
    resolveMutation,
    openMerge,
    closeMerge,
    keepSeparate,
    mergeIntoExisting,
  } as const;
}
