/**
 * Reui-style combobox built from shadcn `Popover` + `Command` primitives.
 *
 * Stands in for `@reui/combobox` since reui.io currently exposes no
 * `/r/combobox.json` payload (probed 2026-05-26). API matches the typical
 * shadcn combobox pattern: controlled value, searchable options, custom
 * trigger label.
 */

import { Check, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';

import {
  formControlClassName,
  formControlHoverClassName,
  formControlPlaceholderClassName,
} from '../../lib/form-control.js';
import { cn } from '../../lib/utils.js';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../shadcn/command.js';
import { Popover, PopoverContent, PopoverTrigger } from '../shadcn/popover.js';

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxProps {
  options: readonly ComboboxOption[];
  value: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyLabel = 'No options.',
  className,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selectedLabel = React.useMemo(
    () => options.find(o => o.value === value)?.label ?? null,
    [options, value],
  );

  const handleSelect = React.useCallback(
    (next: string) => {
      onValueChange(next);
      setOpen(false);
    },
    [onValueChange],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        data-form-control=""
        className={cn(
          formControlClassName,
          formControlHoverClassName,
          formControlPlaceholderClassName,
          'inline-flex h-8 w-full items-center justify-between px-2.5 py-1 text-sm',
          className,
        )}>
        <span className={cn(!selectedLabel && 'text-muted-foreground')}>
          {selectedLabel ?? placeholder}
        </span>
        <ChevronsUpDown className="ms-2 size-4 shrink-0 opacity-50" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options.map(option => (
                <ComboboxRow
                  key={option.value}
                  option={option}
                  selected={value === option.value}
                  onSelect={handleSelect}
                />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface ComboboxRowProps {
  option: ComboboxOption;
  selected: boolean;
  onSelect: (value: string) => void;
}

const ComboboxRow = React.memo(function ComboboxRow({
  option,
  selected,
  onSelect,
}: ComboboxRowProps) {
  const handleSelect = React.useCallback(() => onSelect(option.value), [onSelect, option.value]);
  return (
    <CommandItem value={option.label} onSelect={handleSelect}>
      <Check className={cn('me-2 size-4', selected ? 'opacity-100' : 'opacity-0')} aria-hidden />
      {option.label}
    </CommandItem>
  );
});
