'use client';

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
}

export function CostCenterFormSheet({
  open,
  onOpenChange,
  costCenter,
  onCreated,
}: CostCenterFormSheetProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(costCenter);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when sheet re-opens.
  useEffect(() => {
    setName(costCenter?.name ?? '');
    setCode(costCenter?.code ?? '');
  }, [costCenter, open]);

  const createMutation = useMutation(
    trpc.organizationDefinitions.costCenter.create.mutationOptions({
      onSuccess: created => {
        toast.success('Cost center created');
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.costCenter.list.queryKey(),
        });
        onCreated?.({ id: created.id, name: created.name });
        onOpenChange(false);
      },
      onError: err => toast.error(err.message),
    }),
  );

  const updateMutation = useMutation(
    trpc.organizationDefinitions.costCenter.update.mutationOptions({
      onSuccess: () => {
        toast.success('Cost center updated');
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.costCenter.list.queryKey(),
        });
        onOpenChange(false);
      },
      onError: err => toast.error(err.message),
    }),
  );

  const archiveMutation = useMutation(
    trpc.organizationDefinitions.costCenter.archive.mutationOptions({
      onSuccess: () => {
        toast.success('Cost center archived');
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.costCenter.list.queryKey(),
        });
        onOpenChange(false);
      },
      onError: err => toast.error(err.message),
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name: name.trim(), code: code.trim().toUpperCase() };
    if (isEdit && costCenter) {
      updateMutation.mutate({ id: costCenter.id, ...payload });
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
              <Input
                id="cc-name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-code">Code</Label>
              <Input
                id="cc-code"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
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
                onClick={() => archiveMutation.mutate({ id: costCenter.id })}>
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
              <Button type="submit" disabled={submitting || !name.trim() || !code.trim()}>
                {isEdit ? 'Save' : 'Create'}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
