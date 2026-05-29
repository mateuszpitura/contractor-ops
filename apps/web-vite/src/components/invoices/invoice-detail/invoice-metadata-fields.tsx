/**
 * Invoice metadata fields (DatePicker + CurrencyInput sub-components).
 * Step 11 codemod port from
 * apps/web/src/components/invoices/invoice-detail/invoice-metadata-fields.tsx:
 *   - `@/lib/currency-conversion` → `../../../lib/currency-conversion.js`
 */

import { Calendar } from '@contractor-ops/ui/components/shadcn/calendar';
import { formControlPopoverRender } from '@contractor-ops/ui/components/shadcn/form-control-trigger';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import { cn } from '@contractor-ops/ui/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { displayToMinor, minorToDisplay } from '../../../lib/currency-conversion.js';

function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  disabled?: boolean;
  pickDateLabel?: string;
}

export function DatePicker({ value, onChange, disabled, pickDateLabel }: DatePickerProps) {
  const parsed = value ? new Date(value) : undefined;
  const isValid = parsed && !Number.isNaN(parsed.getTime());

  const handleSelect = useCallback(
    (date: Date | undefined) => {
      if (date) onChange(toDateString(date));
    },
    [onChange],
  );

  return (
    <Popover>
      <PopoverTrigger
        disabled={disabled}
        render={formControlPopoverRender(cn('text-start', !isValid && 'text-muted-foreground'))}>
        <CalendarIcon className="me-2 h-4 w-4" />
        {isValid ? format(parsed, 'yyyy-MM-dd') : (pickDateLabel ?? 'Pick a date')}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={isValid ? parsed : undefined} onSelect={handleSelect} />
      </PopoverContent>
    </Popover>
  );
}

export interface CurrencyInputProps {
  id: string;
  value: number;
  onChange: (minor: number) => void;
  disabled?: boolean;
}

export function CurrencyInput({ id, value, onChange, disabled }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(minorToDisplay(value));

  useEffect(() => {
    setDisplayValue(minorToDisplay(value));
  }, [value]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (/^[0-9]*[.,]?[0-9]{0,2}$/.test(raw) || raw === '') {
      setDisplayValue(raw);
    }
  }, []);

  const handleBlur = useCallback(() => {
    const minor = displayToMinor(displayValue.replace(',', '.'));
    onChange(minor);
    setDisplayValue(minorToDisplay(minor));
  }, [displayValue, onChange]);

  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      className="font-mono text-[13px] text-end"
      value={displayValue}
      disabled={disabled}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
