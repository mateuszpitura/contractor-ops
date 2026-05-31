/**
 * Pending project merge inbox — Step 10 batch 6 / Step 11 codemod port from
 * apps/web/src/components/organization/projects/pending-merges-inbox.tsx:
 *   - `@/trpc/init` → `../../../providers/trpc-provider.js#useTRPC`
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { AlertTriangle } from 'lucide-react';
import { useCallback } from 'react';
import type { usePendingMergesInbox } from '../hooks/use-pending-merges-inbox.js';
import { SourceBadge } from '../shared/source-badge.js';

type InboxHandle = ReturnType<typeof usePendingMergesInbox>;
type InboxItem = InboxHandle['items'][number];
type MergeCandidate = InboxHandle['candidates'][string];

function PendingMergeRow({ row, onOpen }: { row: InboxItem; onOpen: (row: InboxItem) => void }) {
  const handleClick = useCallback(() => onOpen(row), [onOpen, row]);
  return (
    <li className="flex items-center justify-between gap-2">
      <span>
        <SourceBadge source={row.source} /> <strong>{row.incomingName}</strong>
      </span>
      <Button size="sm" variant="secondary" onClick={handleClick}>
        Resolve
      </Button>
    </li>
  );
}

function MergeCandidateOption({
  id,
  candidate,
  selected,
  onChoose,
}: {
  id: string;
  candidate: MergeCandidate | undefined;
  selected: boolean;
  onChoose: (id: string) => void;
}) {
  const handleChange = useCallback(() => onChoose(id), [onChoose, id]);
  return (
    <label className="hover:bg-muted/40 flex items-center gap-2 rounded-md border p-2 text-sm">
      <input
        type="radio"
        name="merge-target"
        value={id}
        checked={selected}
        onChange={handleChange}
      />
      <span className="font-medium">{candidate?.name ?? id}</span>
      {candidate?.source && <SourceBadge source={candidate.source} />}
    </label>
  );
}

export function PendingMergesInbox({ inbox }: { inbox: ReturnType<typeof usePendingMergesInbox> }) {
  const {
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
  } = inbox;

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) closeMerge();
    },
    [closeMerge],
  );

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
              <PendingMergeRow key={row.id} row={row} onOpen={openMerge} />
            ))}
          </ul>
        </div>
      </div>

      <Dialog open={Boolean(activeMerge)} onOpenChange={handleDialogOpenChange}>
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
            <DialogBody className="space-y-3 py-2">
              <p className="text-muted-foreground text-sm">
                Existing project(s) with the same name:
              </p>
              <div className="space-y-2">
                {activeMerge.candidateProjectIds.map(id => (
                  <MergeCandidateOption
                    key={id}
                    id={id}
                    candidate={candidates[id]}
                    selected={chosenTarget === id}
                    onChoose={setChosenTarget}
                  />
                ))}
              </div>
            </DialogBody>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={keepSeparate} disabled={resolveMutation.isPending}>
              Keep separate
            </Button>
            <Button
              onClick={mergeIntoExisting}
              disabled={resolveMutation.isPending || !chosenTarget}>
              Merge into existing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
