/**
 * Team create/edit sheet.
 *
 * Reused by contractor wizard "Add new team" (follow-up).
 */

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
import { useCallback, useEffect, useState } from 'react';

import type { useTeamFormSheet } from '../hooks/use-team-form-sheet.js';

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
  team?: TeamRow | null;
  onCreated?: (team: { id: string; name: string }) => void;
  formSheet: ReturnType<typeof useTeamFormSheet>;
}

export function TeamFormSheet({
  open,
  onOpenChange,
  team,
  onCreated,
  formSheet,
}: TeamFormSheetProps) {
  const isEdit = Boolean(team);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const { createMutation, updateMutation, archiveMutation, isSubmitting } = formSheet;

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when sheet re-opens, not only when `team` swaps.
  useEffect(() => {
    setName(team?.name ?? '');
    setCode(team?.code ?? '');
  }, [team, open]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const payload = { name: name.trim(), code: code.trim() || undefined };
      if (isEdit && team) {
        updateMutation.mutate({ id: team.id, ...payload });
      } else {
        createMutation.mutate(payload);
      }
    },
    [name, code, isEdit, team, updateMutation, createMutation],
  );

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value),
    [],
  );
  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setCode(e.target.value),
    [],
  );
  const handleArchive = useCallback(() => {
    if (team) archiveMutation.mutate({ id: team.id });
  }, [team, archiveMutation]);

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
                onChange={handleNameChange}
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
                onChange={handleCodeChange}
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
                onClick={handleArchive}>
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
              <Button type="submit" disabled={isSubmitting || !name.trim()}>
                {isEdit ? 'Save' : 'Create'}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
