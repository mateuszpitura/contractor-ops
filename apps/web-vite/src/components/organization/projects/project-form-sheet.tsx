/**
 * Project create/edit sheet — Step 10 batch 6 / Step 11 codemod port from
 * apps/web/src/components/organization/projects/project-form-sheet.tsx:
 *   - `@/trpc/init` → `../../../providers/trpc-provider.js#useTRPC`
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
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { useProjectFormSheet } from '../hooks/use-project-form-sheet.js';

export interface ProjectRow {
  id: string;
  name: string;
  code: string | null;
  teamId: string | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  budgetMinor: number | null;
  budgetCurrency: string | null;
}

interface ProjectFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: ProjectRow | null;
  onCreated?: (project: { id: string; name: string }) => void;
  formSheet: ReturnType<typeof useProjectFormSheet>;
}

const formatDateInput = (value: Date | string | null): string => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString().slice(0, 10);
};

export function ProjectFormSheet({
  open,
  onOpenChange,
  project,
  formSheet,
}: ProjectFormSheetProps) {
  const isEdit = Boolean(project);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [teamId, setTeamId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budgetMinor, setBudgetMinor] = useState<string>('');
  const [budgetCurrency, setBudgetCurrency] = useState<string>('');

  const { teams, createMutation, updateMutation, archiveMutation, isSubmitting } = formSheet;

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when sheet re-opens.
  useEffect(() => {
    setName(project?.name ?? '');
    setCode(project?.code ?? '');
    setTeamId(project?.teamId ?? '');
    setStartDate(formatDateInput(project?.startDate ?? null));
    setEndDate(formatDateInput(project?.endDate ?? null));
    setBudgetMinor(project?.budgetMinor == null ? '' : String(project.budgetMinor));
    setBudgetCurrency(project?.budgetCurrency ?? '');
  }, [project, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedCode = code.trim() || undefined;
    const teamIdInput = teamId.trim() || undefined;
    const budgetMinorNum = budgetMinor.trim() ? Number(budgetMinor) : undefined;
    const currencyInput = budgetCurrency.trim().toUpperCase() || undefined;

    if (budgetMinorNum != null && (Number.isNaN(budgetMinorNum) || budgetMinorNum <= 0)) {
      toast.error('Budget must be a positive integer (in minor units)');
      return;
    }

    const payload = {
      name: trimmedName,
      code: trimmedCode,
      teamId: teamIdInput,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      budgetMinor: budgetMinorNum,
      budgetCurrency: currencyInput,
    };

    if (isEdit && project) {
      updateMutation.mutate({ id: project.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{isEdit ? 'Edit Project' : 'New Project'}</SheetTitle>
            <SheetDescription>
              {isEdit
                ? 'Update the project details. Archiving preserves existing assignments.'
                : 'Create a new project. You can change its team or budget later.'}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="project-code">Code</Label>
                <Input id="project-code" value={code} onChange={e => setCode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-team">Team</Label>
                <select
                  id="project-team"
                  className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                  value={teamId}
                  onChange={e => setTeamId(e.target.value)}>
                  <option value="">No team</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="project-start">Start date</Label>
                <Input
                  id="project-start"
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-end">End date</Label>
                <Input
                  id="project-end"
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="project-budget">Budget (minor units)</Label>
                <Input
                  id="project-budget"
                  type="number"
                  min={1}
                  step={1}
                  value={budgetMinor}
                  onChange={e => setBudgetMinor(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-currency">Currency</Label>
                <Input
                  id="project-currency"
                  value={budgetCurrency}
                  onChange={e => setBudgetCurrency(e.target.value.toUpperCase())}
                  maxLength={3}
                  placeholder="EUR"
                />
              </div>
            </div>
          </div>
          <SheetFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            {isEdit && project ? (
              <Button
                type="button"
                variant="destructive"
                disabled={archiveMutation.isPending}
                onClick={() => archiveMutation.mutate({ id: project.id })}>
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
