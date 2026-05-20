'use client';

// Side-sheet form for create / edit of a Team.
// Reused inline by the contractor wizard's "Add new team" footer.

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@contractor-ops/ui/components/shadcn/sheet';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/init';

export interface TeamRow {
  id: string;
  name: string;
  code: string | null;
  managerUserId: string | null;
  fallbackApproverId: string | null;
}

interface TeamFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing row when editing; omit for create. */
  team?: TeamRow | null;
  /** Called after a successful create with the new team id (used by wizard auto-select). */
  onCreated?: (team: { id: string; name: string }) => void;
}

export function TeamFormSheet({ open, onOpenChange, team, onCreated }: TeamFormSheetProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(team);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  // Reset form when the underlying team changes (edit-mode swap) or when the
  // sheet is reopened for a fresh create.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when sheet re-opens, not only when `team` swaps.
  useEffect(() => {
    setName(team?.name ?? '');
    setCode(team?.code ?? '');
  }, [team, open]);

  const createMutation = useMutation(
    trpc.organizationDefinitions.team.create.mutationOptions({
      onSuccess: created => {
        toast.success('Team created');
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.team.list.queryKey(),
        });
        onCreated?.({ id: created.id, name: created.name });
        onOpenChange(false);
      },
      onError: err => toast.error(err.message),
    }),
  );

  const updateMutation = useMutation(
    trpc.organizationDefinitions.team.update.mutationOptions({
      onSuccess: () => {
        toast.success('Team updated');
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.team.list.queryKey(),
        });
        onOpenChange(false);
      },
      onError: err => toast.error(err.message),
    }),
  );

  const archiveMutation = useMutation(
    trpc.organizationDefinitions.team.archive.mutationOptions({
      onSuccess: () => {
        toast.success('Team archived');
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.team.list.queryKey(),
        });
        onOpenChange(false);
      },
      onError: err => toast.error(err.message),
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name: name.trim(), code: code.trim() || undefined };
    if (isEdit && team) {
      updateMutation.mutate({ id: team.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const submitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{isEdit ? 'Edit Team' : 'New Team'}</SheetTitle>
            <SheetDescription>
              {isEdit
                ? 'Update the team details. Archiving preserves history on existing contractors.'
                : 'Create a new team that contractors and contracts can be assigned to.'}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">Name</Label>
              <Input
                id="team-name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
                minLength={1}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-code">Code</Label>
              <Input
                id="team-code"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="optional"
                maxLength={40}
              />
            </div>
          </div>
          <SheetFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            {isEdit && team ? (
              <Button
                type="button"
                variant="destructive"
                disabled={archiveMutation.isPending}
                onClick={() => archiveMutation.mutate({ id: team.id })}>
                Archive
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <SheetClose
                render={
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                }
              />
              <Button type="submit" disabled={submitting || !name.trim()}>
                {isEdit ? 'Save' : 'Create'}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
