'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
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
import { usePermissions } from '@/hooks/use-permissions';
import { canViewSensitivePii, maskTaxId } from '@/lib/mask-pii';
import { trpc } from '@/trpc/init';
import type { ContractWizardFormValues } from './wizard-dialog';

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
  const t = useTranslations('Contracts.wizard');
  const { role } = usePermissions();
  const showPii = canViewSensitivePii(role);
  const [contractorSearch, setContractorSearch] = useState('');
  const [contractorPopoverOpen, setContractorPopoverOpen] = useState(false);
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
  const { data: contractorsData } = useQuery(
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
    label: t(`typeOptions.${type}`),
  }));

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
      {/* Contractor picker */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t('fields.contractor')}</Label>
        {contractorId ? (
          <Input
            value={selectedContractor?.displayName ?? contractorId}
            readOnly
            className="bg-muted"
          />
        ) : (
          <Popover open={contractorPopoverOpen} onOpenChange={setContractorPopoverOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  className="w-full justify-start font-normal"
                  role="combobox"
                  aria-expanded={contractorPopoverOpen}
                />
              }>
              {selectedContractor?.displayName ?? (
                <span className="text-muted-foreground">{t('fields.contractorPlaceholder')}</span>
              )}
            </PopoverTrigger>
            <PopoverContent className="w-[--anchor-width] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder={t('fields.contractorPlaceholder')}
                  value={contractorSearch}
                  onValueChange={setContractorSearch}
                />
                <CommandList>
                  <CommandEmpty>{t('fields.noContractors')}</CommandEmpty>
                  <CommandGroup>
                    {contractors.map(contractor => (
                      <CommandItem
                        key={contractor.id}
                        value={contractor.id}
                        onSelect={() => {
                          setValue('contractorId', contractor.id, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          setContractorPopoverOpen(false);
                          setContractorSearch('');
                        }}>
                        <span>{contractor.displayName}</span>
                        {contractor.taxId ? (
                          <span className="ms-auto text-xs text-muted-foreground font-mono">
                            {showPii
                              ? String(contractor.taxId)
                              : maskTaxId(String(contractor.taxId))}
                          </span>
                        ) : null}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
        {errors.contractorId && (
          <p className="text-sm text-destructive">{errors.contractorId.message}</p>
        )}
      </div>

      {/* Contract title */}
      <div className="space-y-2">
        <Label htmlFor="title" className="text-[13px]">
          {t('fields.title')}
        </Label>
        <Input id="title" {...register('title')} />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>

      {/* Contract type */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t('fields.type')}</Label>
        <Select
          value={watch('type') ?? ''}
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
        {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
      </div>

      {/* Start date */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t('fields.startDate')}</Label>
        <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
          <PopoverTrigger
            render={<Button variant="outline" className="w-full justify-start font-normal" />}>
            <CalendarIcon className="me-2 h-4 w-4" />
            {startDate ? (
              format(new Date(startDate), 'PPP')
            ) : (
              <span className="text-muted-foreground">{t('fields.selectDate')}</span>
            )}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate ? new Date(startDate) : undefined}
              onSelect={handleStartDateSelect}
            />
          </PopoverContent>
        </Popover>
        {errors.startDate && <p className="text-sm text-destructive">{errors.startDate.message}</p>}
      </div>

      {/* End date (optional) */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t('fields.endDate')}</Label>
        <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
          <PopoverTrigger
            render={<Button variant="outline" className="w-full justify-start font-normal" />}>
            <CalendarIcon className="me-2 h-4 w-4" />
            {endDate ? (
              format(new Date(endDate), 'PPP')
            ) : (
              <span className="text-muted-foreground">{t('fields.selectDate')}</span>
            )}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate ? new Date(endDate) : undefined}
              onSelect={handleEndDateSelect}
              disabled={date => (startDate ? date < new Date(startDate) : false)}
            />
          </PopoverContent>
        </Popover>
        {errors.endDate && <p className="text-sm text-destructive">{errors.endDate.message}</p>}
      </div>

      {/* Notice period */}
      <div className="space-y-2">
        <Label htmlFor="noticePeriodDays" className="text-[13px]">
          {t('fields.noticePeriod')}
        </Label>
        <Input
          id="noticePeriodDays"
          type="number"
          min="1"
          placeholder="30"
          {...register('noticePeriodDays', { valueAsNumber: true })}
        />
        {errors.noticePeriodDays && (
          <p className="text-sm text-destructive">{errors.noticePeriodDays.message}</p>
        )}
      </div>

      {/* Auto-renewal */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="autoRenewal"
          checked={autoRenewal}
          onCheckedChange={checked =>
            setValue('autoRenewal', checked === true, { shouldDirty: true })
          }
        />
        <Label htmlFor="autoRenewal" className="text-[13px] cursor-pointer">
          {t('fields.autoRenewal')}
        </Label>
      </div>
    </div>
  );
}
