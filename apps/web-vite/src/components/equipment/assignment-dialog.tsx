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
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Loader2 } from 'lucide-react';
import { memo, useCallback } from 'react';

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

interface Contractor {
  id: string;
  legalName: string;
  displayName: string | null;
}

interface ContractorOptionProps {
  contractor: Contractor;
  isSelected: boolean;
  onSelect: (id: string, displayName: string) => void;
}

// memo: rerendered per contractor row in search list
const ContractorOption = memo(function ContractorOption({
  contractor,
  isSelected,
  onSelect,
}: ContractorOptionProps) {
  const handleSelect = useCallback(() => {
    onSelect(contractor.id, contractor.displayName ?? contractor.legalName);
  }, [contractor.id, contractor.displayName, contractor.legalName, onSelect]);

  return (
    <CommandItem
      value={contractor.id}
      onSelect={handleSelect}
      className={isSelected ? 'bg-accent' : ''}>
      <span>{contractor.displayName ?? contractor.legalName}</span>
    </CommandItem>
  );
});

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

  const handleSelectContractor = useCallback(
    (id: string, displayName: string) => {
      setSelectedContractorId(id);
      setSelectedContractorName(displayName);
    },
    [setSelectedContractorId, setSelectedContractorName],
  );

  const handleCancel = useCallback(() => handleOpenChange(false), [handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('detail.assignToContractor')}</DialogTitle>
          <DialogDescription>{equipmentName}</DialogDescription>
        </DialogHeader>

        <DialogBody>
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
                  <ContractorOption
                    key={contractor.id}
                    contractor={contractor}
                    isSelected={selectedContractorId === contractor.id}
                    onSelect={handleSelectContractor}
                  />
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
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
