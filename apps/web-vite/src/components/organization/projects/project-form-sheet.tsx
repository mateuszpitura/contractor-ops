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
import { useCallback, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';

import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import type { useProjectFormSheet as UseProjectFormSheet } from '../hooks/use-project-form-sheet.js';
import { useProjectFormSheet } from '../hooks/use-project-form-sheet.js';

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
  formSheet: ReturnType<typeof UseProjectFormSheet>;
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
  const toasts = useCommonToasts();

  const nameId = useId();
  const codeId = useId();
  const teamFieldId = useId();
  const startId = useId();
  const endId = useId();
  const budgetId = useId();
  const currencyId = useId();

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

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedName = name.trim();
      const trimmedCode = code.trim() || undefined;
      const teamIdInput = teamId.trim() || undefined;
      const budgetMinorNum = budgetMinor.trim() ? Number(budgetMinor) : undefined;
      const currencyInput = budgetCurrency.trim().toUpperCase() || undefined;

      if (budgetMinorNum != null && (Number.isNaN(budgetMinorNum) || budgetMinorNum <= 0)) {
        toast.error(toasts.budgetMustBePositive());
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
    },
    [
      name,
      code,
      teamId,
      budgetMinor,
      budgetCurrency,
      startDate,
      endDate,
      isEdit,
      project,
      updateMutation,
      createMutation,
      toasts,
    ],
  );

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value),
    [],
  );
  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setCode(e.target.value),
    [],
  );
  const handleTeamChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setTeamId(e.target.value),
    [],
  );
  const handleStartDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value),
    [],
  );
  const handleEndDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value),
    [],
  );
  const handleBudgetMinorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setBudgetMinor(e.target.value),
    [],
  );
  const handleBudgetCurrencyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setBudgetCurrency(e.target.value.toUpperCase()),
    [],
  );
  const handleArchive = useCallback(() => {
    if (project) archiveMutation.mutate({ id: project.id });
  }, [project, archiveMutation]);

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
              <Label htmlFor={nameId}>Name</Label>
              <Input id={nameId} value={name} onChange={handleNameChange} required autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor={codeId}>Code</Label>
                <Input id={codeId} value={code} onChange={handleCodeChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={teamFieldId}>Team</Label>
                <select
                  id={teamFieldId}
                  className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                  value={teamId}
                  onChange={handleTeamChange}>
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
                <Label htmlFor={startId}>Start date</Label>
                <Input
                  id={startId}
                  type="date"
                  value={startDate}
                  onChange={handleStartDateChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={endId}>End date</Label>
                <Input id={endId} type="date" value={endDate} onChange={handleEndDateChange} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor={budgetId}>Budget (minor units)</Label>
                <Input
                  id={budgetId}
                  type="number"
                  min={1}
                  step={1}
                  value={budgetMinor}
                  onChange={handleBudgetMinorChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={currencyId}>Currency</Label>
                <Input
                  id={currencyId}
                  value={budgetCurrency}
                  onChange={handleBudgetCurrencyChange}
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

type ProjectFormSheetWiredProps = Omit<ProjectFormSheetProps, 'formSheet'>;

export function ProjectFormSheetWired(props: ProjectFormSheetWiredProps) {
  const formSheet = useProjectFormSheet({
    onOpenChange: props.onOpenChange,
    onCreated: props.onCreated,
  });
  return <ProjectFormSheet {...props} formSheet={formSheet} />;
}
