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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        className={cn(
          'inline-flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
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
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}>
                  <Check
                    className={cn(
                      'me-2 size-4',
                      value === option.value ? 'opacity-100' : 'opacity-0',
                    )}
                    aria-hidden
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
