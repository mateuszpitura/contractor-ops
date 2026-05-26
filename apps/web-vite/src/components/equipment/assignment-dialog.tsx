import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@contractor-ops/ui/components/shadcn/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Loader2 } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import type { useAssignmentDialog } from './hooks/use-equipment-assignment.js';

export interface AssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentId: string;
  equipmentName: string;
}

export type AssignmentDialogViewProps = AssignmentDialogProps &
  ReturnType<typeof useAssignmentDialog>;

/**
 * Dialog with contractor search/select to assign equipment.
 */
export function AssignmentDialogView({
  open,
  equipmentName,
  search,
  setSearch,
  selectedContractorId,
  setSelectedContractorId,
  setSelectedContractorName,
  contractorsQuery,
  contractors,
  assignMutation,
  handleAssign,
  handleOpenChange,
}: AssignmentDialogViewProps) {
  const t = useTranslations('Equipment');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            onClick={() => handleOpenChange(false)}
            disabled={assignMutation.isPending}>
            {t('form.cancel')}
          </Button>
          <Button
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
