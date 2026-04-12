'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import {
  HANDELSREGISTER_COURTS,
  type HandelsregisterCourt,
} from '@contractor-ops/validators';

import { Button } from '@/components/ui/button';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

export interface HandelsregisterValue {
  court: string;
  type: 'HRB' | 'HRA';
  number: string;
}

export interface HandelsregisterInputProps {
  value: Partial<HandelsregisterValue> | undefined;
  onChange: (value: Partial<HandelsregisterValue> | undefined) => void;
  error?: string;
  legend: string;
  required?: boolean;
}

/**
 * Composite Handelsregister input rendered as a `<fieldset>` with a single
 * logical legend. All three parts (court, register type, number) are required
 * together — partial completion is flagged by the schema; the UI echoes the
 * same error via `role="alert"`.
 *
 * The court selector is a shadcn Command-in-Popover (Radix Combobox pattern)
 * so the ~126 Amtsgerichte can be filtered by substring search. Radio choice
 * between HRB / HRA defaults to HRB (the more common register for capital
 * companies). Numeric input is free-form but constrained to 7 digits with
 * `inputMode="numeric"` for mobile keyboards and `pattern="\\d{0,7}"` as a
 * hint to the browser validator.
 *
 * Accessibility contract (UI-SPEC §5):
 *   - `<fieldset>` with `aria-labelledby` pointing at `<legend>`
 *   - `aria-describedby` aggregating example + error nodes
 *   - Each sub-control has its own `aria-label` naming its role in the group
 *   - Tab order: court → HRB/HRA → number → next field
 */
export function HandelsregisterInput({
  value,
  onChange,
  error,
  legend,
  required = false,
}: HandelsregisterInputProps): JSX.Element {
  const reactId = useId();
  const legendId = `handelsregister-legend-${reactId}`;
  const hintId = `handelsregister-hint-${reactId}`;
  const errorId = `handelsregister-error-${reactId}`;
  const [open, setOpen] = useState(false);

  const current = value ?? {};
  const courtCode = current.court;
  const selectedCourt = useMemo<HandelsregisterCourt | undefined>(
    () => HANDELSREGISTER_COURTS.find(c => c.code === courtCode),
    [courtCode],
  );

  const sortedCourts = useMemo(
    () =>
      [...HANDELSREGISTER_COURTS].sort((a, b) =>
        a.name.localeCompare(b.name, 'de'),
      ),
    [],
  );

  function patch(next: Partial<HandelsregisterValue>) {
    const merged = { ...current, ...next };
    onChange(merged);
  }

  const describedBy = [hintId, error ? errorId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <fieldset
      aria-labelledby={legendId}
      aria-describedby={describedBy}
      aria-required={required ? 'true' : undefined}
      className="space-y-2 rounded-lg border border-border p-3">
      <legend id={legendId} className="px-1 text-sm font-medium">
        {legend}
        {required ? (
          <span aria-hidden="true" className="ms-1 text-destructive">
            *
          </span>
        ) : null}
      </legend>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        {/* Court combobox */}
        <div className="flex-1 min-w-0 space-y-1">
          <Label htmlFor={`${legendId}-court`} className="sr-only">
            Registry court
          </Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger render={
              <Button
                id={`${legendId}-court`}
                type="button"
                variant="outline"
                role="combobox"
                aria-label="Registry court"
                aria-expanded={open}
                aria-invalid={error ? 'true' : undefined}
                className={cn('h-9 w-full justify-between font-normal', !selectedCourt && 'text-muted-foreground')}>
                <span className="truncate">
                  {selectedCourt ? selectedCourt.name : 'Select court...'}
                </span>
                <ChevronsUpDown className="ms-2 size-4 shrink-0 opacity-50" aria-hidden="true" />
              </Button>
            } />
            <PopoverContent className="p-0" align="start">
              <Command>
                <CommandInput placeholder="Gericht suchen..." />
                <CommandList>
                  <CommandEmpty>No court found.</CommandEmpty>
                  <CommandGroup>
                    {sortedCourts.map(court => (
                      <CommandItem
                        key={court.code}
                        value={`${court.name} ${court.city}`}
                        onSelect={() => {
                          patch({ court: court.code });
                          setOpen(false);
                        }}>
                        <Check
                          className={cn(
                            'me-2 size-4',
                            courtCode === court.code ? 'opacity-100' : 'opacity-0',
                          )}
                          aria-hidden="true"
                        />
                        <span className="truncate">{court.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Register type radio group */}
        <div className="w-full sm:w-[132px] space-y-1">
          <Label className="sr-only">Register type</Label>
          <RadioGroup
            value={current.type ?? 'HRB'}
            onValueChange={(v: string) => {
              if (v === 'HRB' || v === 'HRA') {
                patch({ type: v });
              }
            }}
            aria-label="Register type"
            className="grid-cols-2 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-1 text-sm">
              <RadioGroupItem value="HRB" aria-label="HRB (Handelsregister B)" />
              <span>HRB</span>
            </label>
            <label className="flex cursor-pointer items-center gap-1 text-sm">
              <RadioGroupItem value="HRA" aria-label="HRA (Handelsregister A)" />
              <span>HRA</span>
            </label>
          </RadioGroup>
        </div>

        {/* Number input */}
        <div className="w-full sm:w-[120px] space-y-1">
          <Label htmlFor={`${legendId}-number`} className="sr-only">
            Registry number
          </Label>
          <Input
            id={`${legendId}-number`}
            type="text"
            inputMode="numeric"
            pattern="\d{0,7}"
            maxLength={7}
            aria-label="Registry number"
            aria-invalid={error ? 'true' : undefined}
            placeholder="123456"
            value={current.number ?? ''}
            onChange={e => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 7);
              patch({ number: digits });
            }}
          />
        </div>
      </div>

      <p id={hintId} className="text-xs text-muted-foreground">
        Example: Amtsgericht München · HRB · 123456
      </p>
      {error ? (
        <p id={errorId} role="alert" aria-live="polite" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
