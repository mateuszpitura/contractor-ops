// Step 11 codemod port from apps/web/src/components/contractors/compliance/handelsregister-input.tsx.

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@contractor-ops/ui/components/shadcn/command';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import { RadioGroup, RadioGroupItem } from '@contractor-ops/ui/components/shadcn/radio-group';
import type { HandelsregisterCourt } from '@contractor-ops/validators';
import { HANDELSREGISTER_COURTS } from '@contractor-ops/validators';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { cn } from '../../../lib/utils.js';

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

export function HandelsregisterInput({
  value,
  onChange,
  error,
  legend,
  required = false,
}: HandelsregisterInputProps) {
  const t = useTranslations('Contractors.handelsregister');
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
    () => [...HANDELSREGISTER_COURTS].sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [],
  );

  function patch(next: Partial<HandelsregisterValue>) {
    const merged = { ...current, ...next };
    onChange(merged);
  }

  const describedBy = [hintId, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <fieldset
      aria-labelledby={legendId}
      aria-describedby={describedBy}
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
        <div className="flex-1 min-w-0 space-y-1">
          <Label htmlFor={`${legendId}-court`} className="sr-only">
            {t('courtLabel')}
          </Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              render={
                <Button
                  id={`${legendId}-court`}
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-label={t('courtAriaLabel')}
                  aria-expanded={open}
                  aria-invalid={error ? 'true' : undefined}
                  className={cn(
                    'h-9 w-full justify-between font-normal',
                    !selectedCourt && 'text-muted-foreground',
                  )}>
                  <span className="truncate">
                    {selectedCourt ? selectedCourt.name : t('selectCourtPlaceholder')}
                  </span>
                  <ChevronsUpDown className="ms-2 size-4 shrink-0 opacity-50" aria-hidden="true" />
                </Button>
              }
            />
            <PopoverContent className="p-0" align="start">
              <Command>
                <CommandInput placeholder={t('courtPlaceholder')} />
                <CommandList>
                  <CommandEmpty>{t('noCourtFound')}</CommandEmpty>
                  <CommandGroup>
                    {sortedCourts.map(court => (
                      <CommandItem
                        key={court.code}
                        value={`${court.name} ${court.city}`}
                        // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
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

        <div className="w-full sm:w-[132px] space-y-1">
          <Label className="sr-only">{t('registerTypeLabel')}</Label>
          <RadioGroup
            value={current.type ?? 'HRB'}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
            onValueChange={(v: string) => {
              if (v === 'HRB' || v === 'HRA') {
                patch({ type: v });
              }
            }}
            aria-label={t('registerTypeAriaLabel')}
            className="grid-cols-2 sm:grid-cols-2">
            <label
              htmlFor={`${legendId}-hrb`}
              className="flex cursor-pointer items-center gap-1 text-sm">
              <RadioGroupItem id={`${legendId}-hrb`} value="HRB" aria-label={t('hrbAriaLabel')} />
              <span>HRB</span>
            </label>
            <label
              htmlFor={`${legendId}-hra`}
              className="flex cursor-pointer items-center gap-1 text-sm">
              <RadioGroupItem id={`${legendId}-hra`} value="HRA" aria-label={t('hraAriaLabel')} />
              <span>HRA</span>
            </label>
          </RadioGroup>
        </div>

        <div className="w-full sm:w-[120px] space-y-1">
          <Label htmlFor={`${legendId}-number`} className="sr-only">
            {t('numberLabel')}
          </Label>
          <Input
            id={`${legendId}-number`}
            type="text"
            inputMode="numeric"
            pattern="\d{0,7}"
            maxLength={7}
            aria-label={t('numberAriaLabel')}
            aria-invalid={error ? 'true' : undefined}
            placeholder="123456"
            value={current.number ?? ''}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 7);
              patch({ number: digits });
            }}
          />
        </div>
      </div>

      <p id={hintId} className="text-xs text-muted-foreground">
        {t('exampleHint')}
      </p>
      {error ? (
        <p id={errorId} role="alert" aria-live="polite" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
