'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentId: string;
  equipmentName: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Dialog with contractor search/select to assign equipment.
 */
export function AssignmentDialog({
  open,
  onOpenChange,
  equipmentId,
  equipmentName,
}: AssignmentDialogProps) {
  const t = useTranslations('Equipment');
  const queryClient = useQueryClient();
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null);
  const [selectedContractorName, setSelectedContractorName] = useState<string>('');
  const [search, setSearch] = useState('');

  // Fetch contractors
  const contractorsQuery = useQuery(
    trpc.contractor.list.queryOptions({
      page: 1,
      pageSize: 50,
      search: search.length >= 2 ? search : undefined,
    }),
  );

  const contractors =
    (
      contractorsQuery.data as
        | { items: Array<{ id: string; displayName: string | null; legalName: string }> }
        | undefined
    )?.items ?? [];

  const assignMutation = useMutation(
    trpc.equipment.assign.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.assigned', { name: selectedContractorName }));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.list.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.getById.queryKey(),
        });
        onOpenChange(false);
        setSelectedContractorId(null);
        setSelectedContractorName('');
        setSearch('');
      },
      onError: () => {
        toast.error(t('error.actionFailed'));
      },
    }),
  );

  const handleAssign = () => {
    if (!selectedContractorId) return;
    assignMutation.mutate({
      equipmentId,
      contractorId: selectedContractorId,
    });
  };

  return (
    <Dialog
      open={open}
      // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
      onOpenChange={v => {
        onOpenChange(v);
        if (!v) {
          setSelectedContractorId(null);
          setSelectedContractorName('');
          setSearch('');
        }
      }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('detail.assignToContractor')}</DialogTitle>
          <DialogDescription>{equipmentName}</DialogDescription>
        </DialogHeader>

        <Command shouldFilter={false} className="rounded-lg border">
          <CommandInput
            placeholder={t('search.placeholder')}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {contractorsQuery.isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                t('search.notFound')
              )}
            </CommandEmpty>
            <CommandGroup>
              {contractors.map(contractor => (
                <CommandItem
                  key={contractor.id}
                  value={contractor.id}
                  // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
                  onSelect={() => {
                    setSelectedContractorId(contractor.id);
                    setSelectedContractorName(contractor.displayName ?? contractor.legalName);
                  }}
                  className={selectedContractorId === contractor.id ? 'bg-accent' : ''}>
                  <span>{contractor.displayName ?? contractor.legalName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
            onClick={() => onOpenChange(false)}
            disabled={assignMutation.isPending}>
            {t('form.cancel')}
          </Button>
          <Button
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={handleAssign}
            disabled={!selectedContractorId || assignMutation.isPending}>
            {!!assignMutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t('detail.assignToContractor')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
