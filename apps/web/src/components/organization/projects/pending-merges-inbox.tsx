'use client';

// Inline banner + dialog for resolving Pending Project Merges. The cron seeds
// these rows on name-collision; an admin resolves each via "Merge" or "Keep".

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { SourceBadge } from '@/components/organization/shared/source-badge';
import { trpc } from '@/trpc/init';

interface PendingMergeRow {
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

export function PendingMergesInbox() {
  const queryClient = useQueryClient();
  const pendingQuery = useQuery(trpc.organizationDefinitions.project.pendingMerges.queryOptions());
  const [activeMerge, setActiveMerge] = useState<PendingMergeRow | null>(null);
  const [chosenTarget, setChosenTarget] = useState<string>('');

  const resolveMutation = useMutation(
    trpc.organizationDefinitions.project.resolveMerge.mutationOptions({
      onSuccess: () => {
        toast.success('Merge resolved');
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.project.pendingMerges.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.project.list.queryKey(),
        });
        setActiveMerge(null);
        setChosenTarget('');
      },
      onError: err => toast.error(err.message),
    }),
  );

  const items = pendingQuery.data?.items ?? [];
  const candidates: Record<string, CandidateInfo> = {};
  for (const c of (pendingQuery.data?.candidates ?? []) as CandidateInfo[]) {
    candidates[c.id] = c;
  }

  if (items.length === 0) return null;

  return (
    <>
      <div
        role="alert"
        className="border-amber-300 bg-amber-50 text-amber-900 flex items-start gap-3 rounded-lg border p-3 text-sm dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="flex-1">
          <p className="font-medium">
            {items.length} pending merge{items.length === 1 ? '' : 's'} from your integrations need
            review.
          </p>
          <ul className="mt-2 space-y-1">
            {items.map(row => (
              <li key={row.id} className="flex items-center justify-between gap-2">
                <span>
                  <SourceBadge source={row.source} /> <strong>{row.incomingName}</strong>
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setActiveMerge(row);
                    setChosenTarget(row.candidateProjectIds[0] ?? '');
                  }}>
                  Resolve
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Dialog open={Boolean(activeMerge)} onOpenChange={open => !open && setActiveMerge(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve merge</DialogTitle>
            <DialogDescription>
              {activeMerge ? (
                <>
                  Incoming: <SourceBadge source={activeMerge.source} />{' '}
                  <strong>{activeMerge.incomingName}</strong>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {activeMerge && (
            <div className="space-y-3 py-2">
              <p className="text-muted-foreground text-sm">
                Existing project(s) with the same name:
              </p>
              <div className="space-y-2">
                {activeMerge.candidateProjectIds.map(id => {
                  const c = candidates[id];
                  return (
                    <label
                      key={id}
                      className="hover:bg-muted/40 flex items-center gap-2 rounded-md border p-2 text-sm">
                      <input
                        type="radio"
                        name="merge-target"
                        value={id}
                        checked={chosenTarget === id}
                        onChange={() => setChosenTarget(id)}
                      />
                      <span className="font-medium">{c?.name ?? id}</span>
                      {c?.source && <SourceBadge source={c.source} />}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() =>
                activeMerge &&
                resolveMutation.mutate({
                  pendingMergeId: activeMerge.id,
                  action: 'keep',
                })
              }
              disabled={resolveMutation.isPending}>
              Keep separate
            </Button>
            <Button
              onClick={() =>
                activeMerge &&
                resolveMutation.mutate({
                  pendingMergeId: activeMerge.id,
                  action: 'merge',
                  mergeIntoProjectId: chosenTarget,
                })
              }
              disabled={resolveMutation.isPending || !chosenTarget}>
              Merge into existing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
