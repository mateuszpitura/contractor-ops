/**
 * Invoice metadata fields (DatePicker + CurrencyInput sub-components).
 * Step 11 codemod port from
 * apps/web/src/components/invoices/invoice-detail/invoice-metadata-fields.tsx:
 *   - `@/lib/currency-conversion` → `../../../lib/currency-conversion.js`
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Calendar } from '@contractor-ops/ui/components/shadcn/calendar';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

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

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={`w-full justify-start text-start font-normal ${
              isValid ? '' : 'text-muted-foreground'
            } ${disabled ? 'pointer-events-none opacity-50 bg-muted' : ''}`}
            disabled={disabled}
          />
        }>
        <CalendarIcon className="me-2 h-4 w-4" />
        {isValid ? format(parsed, 'yyyy-MM-dd') : (pickDateLabel ?? 'Pick a date')}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={isValid ? parsed : undefined}
          onSelect={date => {
            if (date) onChange(toDateString(date));
          }}
        />
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

  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      className="font-mono text-[13px] text-end"
      value={displayValue}
      disabled={disabled}
      onChange={e => {
        const raw = e.target.value;
        if (/^[0-9]*[.,]?[0-9]{0,2}$/.test(raw) || raw === '') {
          setDisplayValue(raw);
        }
      }}
      onBlur={() => {
        const minor = displayToMinor(displayValue.replace(',', '.'));
        onChange(minor);
        setDisplayValue(minorToDisplay(minor));
      }}
    />
  );
}
