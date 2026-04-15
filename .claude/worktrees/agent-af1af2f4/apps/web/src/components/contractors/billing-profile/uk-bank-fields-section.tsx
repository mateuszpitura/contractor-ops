'use client';

import { accountNumberSchema, sortCodeSchema } from '@contractor-ops/validators';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { SortCodeValidator } from '@/components/contractors/billing-profile/sort-code-validator';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

// ---------------------------------------------------------------------------
// UK Bank Fields Section
//
// Phase 63 Plan 04 (D-01): collapsible section in billing-profile edit form.
// Only rendered when contractor.countryCode === 'GB'.
// Sort code auto-formats on blur: 123456 -> displayed as 12-34-56, stored
// hyphen-free. Account number: 8 digits max.
// ---------------------------------------------------------------------------

interface UkBankFieldsSectionProps {
  /** The parent billing profile form instance. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  /** Contractor's country code — only renders for 'GB'. */
  countryCode: string;
}

export function UkBankFieldsSection({ form, countryCode }: UkBankFieldsSectionProps) {
  const t = useTranslations('Payments');
  const [isOpen, setIsOpen] = useState(false);

  // Only render for GB contractors
  if (countryCode !== 'GB') {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-sm font-medium">
          {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          {t('ukBankFieldsTitle')}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-4 rounded-lg border p-4">
        <SortCodeField form={form} />
        <AccountNumberField form={form} />

        {/* Inline sort code validator */}
        <SortCodeValidator
          sortCode={form.watch('ukSortCode') ?? ''}
          accountNumber={form.watch('ukAccountNumber') ?? ''}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SortCodeField({ form }: { form: UseFormReturn<any> }) {
  const t = useTranslations('Payments');

  const formatSortCodeDisplay = useCallback((value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
  }, []);

  return (
    <FormField
      control={form.control}
      name="ukSortCode"
      rules={{
        validate: (value: string | undefined) => {
          if (!value) return true; // optional field
          const result = sortCodeSchema.safeParse(value.replace(/-/g, ''));
          return result.success || t('sortCodeInvalid');
        },
      }}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('sortCodeLabel')}</FormLabel>
          <FormControl>
            <Input
              {...field}
              value={field.value ? formatSortCodeDisplay(field.value) : ''}
              onChange={(e) => {
                // Store digits only (no hyphens)
                const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                field.onChange(digits);
              }}
              onBlur={(e) => {
                field.onBlur();
              }}
              placeholder="12-34-56"
              maxLength={8} // 6 digits + 2 hyphens
              inputMode="numeric"
              autoComplete="off"
              className="font-mono tabular-nums"
            />
          </FormControl>
          <FormDescription>{t('sortCodeHelper')}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AccountNumberField({ form }: { form: UseFormReturn<any> }) {
  const t = useTranslations('Payments');

  return (
    <FormField
      control={form.control}
      name="ukAccountNumber"
      rules={{
        validate: (value: string | undefined) => {
          if (!value) return true; // optional field
          const result = accountNumberSchema.safeParse(value);
          return result.success || t('accountNumberInvalid');
        },
      }}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('accountNumberLabel')}</FormLabel>
          <FormControl>
            <Input
              {...field}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
                field.onChange(digits);
              }}
              placeholder="00000000"
              maxLength={8}
              inputMode="numeric"
              autoComplete="off"
              className="font-mono tabular-nums"
            />
          </FormControl>
          <FormDescription>{t('accountNumberHelper')}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
