import { Calendar } from '@contractor-ops/ui/components/shadcn/calendar';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@contractor-ops/ui/components/shadcn/command';
import { formControlPopoverRender } from '@contractor-ops/ui/components/shadcn/form-control-trigger';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useCallback, useId, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { usePermissions } from '../../../hooks/use-permissions.js';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import { canViewSensitivePii, maskTaxId } from '../../../lib/mask-pii.js';
import type { ContractorListItem } from '../hooks/use-contract-wizard-step-details.js';
import type { ContractWizardFormValues } from './wizard-dialog.js';

const CONTRACT_TYPES = [
  'B2B_MASTER_SERVICE',
  'STATEMENT_OF_WORK',
  'NDA',
  'IP_ASSIGNMENT',
  'DPA',
  'OTHER',
] as const;

function ContractorTaxLabel({ taxId, showPii }: { taxId: string | null; showPii: boolean }) {
  if (!taxId) return null;
  return (
    <span className="ms-auto text-xs text-muted-foreground font-mono">
      {showPii ? String(taxId) : maskTaxId(String(taxId))}
    </span>
  );
}

function ContractorPickerOption({
  contractor,
  showPii,
  onSelect,
}: {
  contractor: ContractorListItem;
  showPii: boolean;
  onSelect: (id: string) => void;
}) {
  const handleSelect = useCallback(() => onSelect(contractor.id), [contractor.id, onSelect]);
  return (
    <CommandItem value={contractor.id} onSelect={handleSelect}>
      <span>{contractor.displayName}</span>
      <ContractorTaxLabel taxId={contractor.taxId} showPii={showPii} />
    </CommandItem>
  );
}

function formatDateOrPlaceholder(isoDate: string | undefined, placeholder: string) {
  if (isoDate) return format(new Date(isoDate), 'PPP');
  return <span className="text-muted-foreground">{placeholder}</span>;
}

interface ContractorPickerFieldProps {
  lockedContractorId?: string;
  selectedContractor: ContractorListItem | undefined;
  selectedContractorId: string | undefined;
  contractors: ContractorListItem[];
  contractorsLoading: boolean;
  search: string;
  onSearchChange: (next: string) => void;
  onPick: (contractorId: string) => void;
  showPii: boolean;
  label: string;
  placeholder: string;
  noResultsLabel: string;
  errorMessage?: string;
}

function ContractorPickerField({
  lockedContractorId,
  selectedContractor,
  selectedContractorId,
  contractors,
  contractorsLoading,
  search,
  onSearchChange,
  onPick,
  showPii,
  label,
  placeholder,
  noResultsLabel,
  errorMessage,
}: ContractorPickerFieldProps) {
  const [open, setOpen] = useState(false);

  const handleContractorSelect = useCallback(
    (id: string) => {
      onPick(id);
      setOpen(false);
    },
    [onPick],
  );

  const inputBlock = (() => {
    if (lockedContractorId) {
      if (contractorsLoading) {
        return <Skeleton className="h-9 w-full rounded-lg" />;
      }
      return (
        <Input
          value={selectedContractor?.displayName ?? lockedContractorId}
          readOnly
          className="disabled:opacity-100"
        />
      );
    }
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={formControlPopoverRender()} role="combobox" aria-expanded={open}>
          {selectedContractor?.displayName ?? (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-(--anchor-width) p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={placeholder} value={search} onValueChange={onSearchChange} />
            <CommandList>
              <CommandEmpty>{noResultsLabel}</CommandEmpty>
              <CommandGroup>
                {contractors.map(contractor => (
                  <ContractorPickerOption
                    key={contractor.id}
                    contractor={contractor}
                    showPii={showPii}
                    onSelect={handleContractorSelect}
                  />
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  })();

  return (
    <div className="flex flex-col gap-2" data-selected-contractor-id={selectedContractorId}>
      <Label className="text-[13px]">{label}</Label>
      {inputBlock}
      {!!errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </div>
  );
}

interface StepDetailsProps {
  form: UseFormReturn<ContractWizardFormValues>;
  contractorId?: string;
  contractorSearch: string;
  contractors: ContractorListItem[];
  contractorsLoading: boolean;
  selectedContractor: ContractorListItem | undefined;
  selectedContractorId: string | undefined;
  setContractorSearch: (search: string) => void;
}

/**
 * Step 1: Contract details.
 */
export function StepDetails({
  form,
  contractorId,
  contractorSearch,
  contractors,
  contractorsLoading,
  selectedContractor,
  selectedContractorId,
  setContractorSearch,
}: StepDetailsProps) {
  const id = useId();
  const t = useTranslations('Contracts.wizard');
  const { role } = usePermissions();
  const showPii = canViewSensitivePii(role);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const startDate = watch('startDate');
  const endDate = watch('endDate');
  const autoRenewal = watch('autoRenewal');

  const contractTypeItems = CONTRACT_TYPES.map(type => ({
    value: type,
    label: tDynLoose(t, 'typeOptions', enumKey(type)),
  }));

  const handleContractorPick = useCallback(
    (nextContractorId: string) => {
      setValue('contractorId', nextContractorId, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setContractorSearch('');
    },
    [setValue, setContractorSearch],
  );

  const handleStartDateSelect = useCallback(
    (date: Date | undefined) => {
      if (date) {
        setValue('startDate', date.toISOString(), {
          shouldDirty: true,
          shouldValidate: true,
        });
        setStartDateOpen(false);
      }
    },
    [setValue],
  );

  const handleEndDateSelect = useCallback(
    (date: Date | undefined) => {
      if (date) {
        setValue('endDate', date.toISOString(), {
          shouldDirty: true,
          shouldValidate: true,
        });
      } else {
        setValue('endDate', undefined, { shouldDirty: true });
      }
      setEndDateOpen(false);
    },
    [setValue],
  );

  const handleTypeChange = useCallback(
    (value: string | null) =>
      setValue('type', (value ?? '') as ContractWizardFormValues['type'], {
        shouldDirty: true,
        shouldValidate: true,
      }),
    [setValue],
  );

  const handleAutoRenewalChange = useCallback(
    (checked: boolean | 'indeterminate') =>
      setValue('autoRenewal', checked === true, { shouldDirty: true }),
    [setValue],
  );

  const isEndDateDisabled = useCallback(
    (date: Date) => (startDate ? date < new Date(startDate) : false),
    [startDate],
  );

  return (
    <div className="space-y-4">
      <ContractorPickerField
        lockedContractorId={contractorId}
        selectedContractor={selectedContractor}
        selectedContractorId={selectedContractorId}
        contractors={contractors}
        contractorsLoading={contractorsLoading}
        search={contractorSearch}
        onSearchChange={setContractorSearch}
        onPick={handleContractorPick}
        showPii={showPii}
        label={t('fields.contractor')}
        placeholder={t('fields.contractorPlaceholder')}
        noResultsLabel={t('fields.noContractors')}
        errorMessage={errors.contractorId?.message}
      />

      <div className="space-y-2">
        <Label htmlFor={`${id}-title`} className="text-[13px]">
          {t('fields.title')}
        </Label>
        <Input id={`${id}-title`} {...register('title')} />
        {!!errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-2">
        <Label className="text-[13px]">{t('fields.type')}</Label>
        <Select
          value={watch('type') ?? ''}
          onValueChange={handleTypeChange}
          items={contractTypeItems}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('fields.typePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {contractTypeItems.map(item => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!!errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-[13px]">{t('fields.startDate')}</Label>
        <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
          <PopoverTrigger render={formControlPopoverRender()}>
            <CalendarIcon className="me-2 h-4 w-4" />
            {formatDateOrPlaceholder(startDate, t('fields.selectDate'))}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate ? new Date(startDate) : undefined}
              onSelect={handleStartDateSelect}
            />
          </PopoverContent>
        </Popover>
        {!!errors.startDate && (
          <p className="text-sm text-destructive">{errors.startDate.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-[13px]">{t('fields.endDate')}</Label>
        <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
          <PopoverTrigger render={formControlPopoverRender()}>
            <CalendarIcon className="me-2 h-4 w-4" />
            {formatDateOrPlaceholder(endDate, t('fields.selectDate'))}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate ? new Date(endDate) : undefined}
              onSelect={handleEndDateSelect}
              disabled={isEndDateDisabled}
            />
          </PopoverContent>
        </Popover>
        {!!errors.endDate && <p className="text-sm text-destructive">{errors.endDate.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${id}-noticePeriodDays`} className="text-[13px]">
          {t('fields.noticePeriod')}
        </Label>
        <Input
          id={`${id}-noticePeriodDays`}
          type="number"
          min="1"
          placeholder="30"
          {...register('noticePeriodDays', { valueAsNumber: true })}
        />
        {!!errors.noticePeriodDays && (
          <p className="text-sm text-destructive">{errors.noticePeriodDays.message}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id={`${id}-autoRenewal`}
          checked={autoRenewal}
          onCheckedChange={handleAutoRenewalChange}
        />
        <Label htmlFor={`${id}-autoRenewal`} className="text-[13px] cursor-pointer">
          {t('fields.autoRenewal')}
        </Label>
      </div>
    </div>
  );
}
