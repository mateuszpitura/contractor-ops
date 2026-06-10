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
import type { useCostCenterFormSheet as UseCostCenterFormSheet } from '../hooks/use-cost-center-form-sheet.js';
import { useCostCenterFormSheet } from '../hooks/use-cost-center-form-sheet.js';

export interface CostCenterRow {
  id: string;
  name: string;
  code: string;
}

interface CostCenterFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costCenter?: CostCenterRow | null;
  onCreated?: (cc: { id: string; name: string }) => void;
  formSheet: ReturnType<typeof UseCostCenterFormSheet>;
}

export function CostCenterFormSheet({
  open,
  onOpenChange,
  costCenter,
  onCreated,
  formSheet,
}: CostCenterFormSheetProps) {
  const isEdit = Boolean(costCenter);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const { createMutation, updateMutation, archiveMutation, isSubmitting } = formSheet;

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when sheet re-opens.
  useEffect(() => {
    setName(costCenter?.name ?? '');
    setCode(costCenter?.code ?? '');
  }, [costCenter, open]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const payload = { name: name.trim(), code: code.trim().toUpperCase() };
      if (isEdit && costCenter) {
        updateMutation.mutate({ id: costCenter.id, ...payload });
      } else {
        createMutation.mutate(payload);
      }
    },
    [name, code, isEdit, costCenter, updateMutation, createMutation],
  );

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value),
    [],
  );
  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setCode(e.target.value.toUpperCase()),
    [],
  );
  const handleArchive = useCallback(() => {
    if (costCenter) archiveMutation.mutate({ id: costCenter.id });
  }, [costCenter, archiveMutation]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{isEdit ? 'Edit Cost Center' : 'New Cost Center'}</SheetTitle>
            <SheetDescription>
              {isEdit
                ? 'Update the cost center details.'
                : 'Code must be uppercase and unique within the organisation.'}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cc-name">Name</Label>
              <Input id="cc-name" value={name} onChange={handleNameChange} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-code">Code</Label>
              <Input
                id="cc-code"
                value={code}
                onChange={handleCodeChange}
                required
                pattern="[A-Z0-9_\-]+"
                title="Uppercase letters, digits, underscores or hyphens"
                maxLength={40}
              />
            </div>
          </div>
          <SheetFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            {isEdit && costCenter ? (
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
              <Button type="submit" disabled={isSubmitting || !name.trim() || !code.trim()}>
                {isEdit ? 'Save' : 'Create'}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

type CostCenterFormSheetWiredProps = Omit<CostCenterFormSheetProps, 'formSheet'>;

export function CostCenterFormSheetWired(props: CostCenterFormSheetWiredProps) {
  const formSheet = useCostCenterFormSheet({
    onOpenChange: props.onOpenChange,
    onCreated: props.onCreated,
  });
  return <CostCenterFormSheet {...props} formSheet={formSheet} />;
}
