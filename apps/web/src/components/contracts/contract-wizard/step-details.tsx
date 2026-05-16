'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/use-permissions';
import { enumKey } from '@/lib/enum-key';
import { canViewSensitivePii, maskTaxId } from '@/lib/mask-pii';
import { trpc } from '@/trpc/init';
import type { ContractWizardFormValues } from './wizard-dialog';
import { tDyn, tDynLoose } from '@/i18n/typed-keys';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContractorListItem {
  id: string;
  displayName: string;
  taxId: string | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTRACT_TYPES = [
  'B2B_MASTER_SERVICE',
  'STATEMENT_OF_WORK',
  'NDA',
  'IP_ASSIGNMENT',
  'DPA',
  'OTHER',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Renders a contractor's tax ID, masked or unmasked depending on PII visibility. */
function ContractorTaxLabel({ taxId, showPii }: { taxId: string | null; showPii: boolean }) {
  if (!taxId) return null;
  return (
    <span className="ms-auto text-xs text-muted-foreground font-mono">
      {showPii ? String(taxId) : maskTaxId(String(taxId))}
    </span>
  );
}

/** Formats an ISO date string for display in a date picker trigger, or returns a placeholder. */
function formatDateOrPlaceholder(isoDate: string | undefined, placeholder: string) {
  if (isoDate) return format(new Date(isoDate), 'PPP');
  return <span className="text-muted-foreground">{placeholder}</span>;
}

// ---------------------------------------------------------------------------
// Contractor picker field (locked-input vs combobox popover)
// ---------------------------------------------------------------------------

interface ContractorPickerFieldProps {
  /** When set, the field is locked to this contractor and not pickable. */
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

  const inputBlock = (() => {
    if (lockedContractorId) {
      if (contractorsLoading) {
        return <Skeleton className="h-9 w-full rounded-lg" />;
      }
      return (
        <Input
          value={selectedContractor?.displayName ?? lockedContractorId}
          readOnly
          className="bg-muted"
        />
      );
    }
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              className="w-full justify-start font-normal"
              role="combobox"
              aria-expanded={open}
            />
          }>
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
                  <CommandItem
                    key={contractor.id}
                    value={contractor.id}
                    // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
                    onSelect={() => {
                      onPick(contractor.id);
                      setOpen(false);
                    }}>
                    <span>{contractor.displayName}</span>
                    <ContractorTaxLabel taxId={contractor.taxId} showPii={showPii} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  })();

  // `selectedContractorId` is forwarded so any caller relying on it for tests
  // / accessibility can read it from the underlying input.
  return (
    <div className="flex flex-col gap-2" data-selected-contractor-id={selectedContractorId}>
      <Label className="text-[13px]">{label}</Label>
      {inputBlock}
      {!!errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StepDetailsProps {
  form: UseFormReturn<ContractWizardFormValues>;
  contractorId?: string;
}

/**
 * Step 1: Contract details.
 * Fields: contractor picker, title, type, start date, end date,
 * notice period, auto-renewal.
 */
export function StepDetails({ form, contractorId }: StepDetailsProps) {
  const id = useId();
  const t = useTranslations('Contracts.wizard');
  const { role } = usePermissions();
  const showPii = canViewSensitivePii(role);
  const [contractorSearch, setContractorSearch] = useState('');
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const selectedContractorId = watch('contractorId');
  const startDate = watch('startDate');
  const endDate = watch('endDate');
  const autoRenewal = watch('autoRenewal');

  // Fetch contractors for picker
  const { data: contractorsData, isLoading: contractorsLoading } = useQuery(
    trpc.contractor.list.queryOptions({
      page: 1,
      pageSize: 50,
      search: contractorSearch.length >= 2 ? contractorSearch : undefined,
    }),
  );

  const contractors = (contractorsData?.items ?? []) as ContractorListItem[];
  const selectedContractor = contractors.find(c => c.id === selectedContractorId);

  // If contractorId prop provided, auto-set and lock
  useEffect(() => {
    if (contractorId && !selectedContractorId) {
      setValue('contractorId', contractorId, { shouldDirty: false });
    }
  }, [contractorId, selectedContractorId, setValue]);

  const contractTypeItems = CONTRACT_TYPES.map(type => ({
    value: type,
    label: tDynLoose(t, 'typeOptions', enumKey(type)),
  }));

  const handleContractorPick = (nextContractorId: string) => {
    setValue('contractorId', nextContractorId, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setContractorSearch('');
  };

  const handleStartDateSelect = (date: Date | undefined) => {
    if (date) {
      setValue('startDate', date.toISOString(), {
        shouldDirty: true,
        shouldValidate: true,
      });
      setStartDateOpen(false);
    }
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    if (date) {
      setValue('endDate', date.toISOString(), {
        shouldDirty: true,
        shouldValidate: true,
      });
    } else {
      setValue('endDate', undefined, { shouldDirty: true });
    }
    setEndDateOpen(false);
  };

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
        // biome-ignore lint/nursery/noJsxPropsBind: stable in-render handler
        onPick={handleContractorPick}
        showPii={showPii}
        label={t('fields.contractor')}
        placeholder={t('fields.contractorPlaceholder')}
        noResultsLabel={t('fields.noContractors')}
        errorMessage={errors.contractorId?.message}
      />

      {/* Contract title */}
      <div className="space-y-2">
        <Label htmlFor={`${id}-title`} className="text-[13px]">
          {t('fields.title')}
        </Label>
        <Input id={`${id}-title`} {...register('title')} />
        {!!errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>

      {/* Contract type */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t('fields.type')}</Label>
        <Select
          value={watch('type') ?? ''}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
          onValueChange={value =>
            setValue('type', (value ?? '') as ContractWizardFormValues['type'], {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
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

      {/* Start date */}
      <div className="flex flex-col gap-2">
        <Label className="text-[13px]">{t('fields.startDate')}</Label>
        <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
          <PopoverTrigger
            render={<Button variant="outline" className="w-full justify-start font-normal" />}>
            <CalendarIcon className="me-2 h-4 w-4" />
            {formatDateOrPlaceholder(startDate, t('fields.selectDate'))}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate ? new Date(startDate) : undefined}
              // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
              onSelect={handleStartDateSelect}
            />
          </PopoverContent>
        </Popover>
        {!!errors.startDate && (
          <p className="text-sm text-destructive">{errors.startDate.message}</p>
        )}
      </div>

      {/* End date (optional) */}
      <div className="flex flex-col gap-2">
        <Label className="text-[13px]">{t('fields.endDate')}</Label>
        <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
          <PopoverTrigger
            render={<Button variant="outline" className="w-full justify-start font-normal" />}>
            <CalendarIcon className="me-2 h-4 w-4" />
            {formatDateOrPlaceholder(endDate, t('fields.selectDate'))}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate ? new Date(endDate) : undefined}
              // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
              onSelect={handleEndDateSelect}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              disabled={date => (startDate ? date < new Date(startDate) : false)}
            />
          </PopoverContent>
        </Popover>
        {!!errors.endDate && <p className="text-sm text-destructive">{errors.endDate.message}</p>}
      </div>

      {/* Notice period */}
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

      {/* Auto-renewal */}
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${id}-autoRenewal`}
          checked={autoRenewal}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
          onCheckedChange={checked =>
            setValue('autoRenewal', checked === true, { shouldDirty: true })
          }
        />
        <Label htmlFor={`${id}-autoRenewal`} className="text-[13px] cursor-pointer">
          {t('fields.autoRenewal')}
        </Label>
      </div>
    </div>
  );
}
