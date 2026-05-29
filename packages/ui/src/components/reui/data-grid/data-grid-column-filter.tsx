// @ts-nocheck — vendored from reui registry; types relaxed pending upstream verbatimModuleSyntax fix

import type { Column } from '@tanstack/react-table';
import { CheckIcon, CirclePlusIcon } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { cn } from '../../../lib/utils.js';
import { Button } from '../../shadcn/button.js';
import { Input } from '../../shadcn/input.js';
import { Popover, PopoverContent, PopoverTrigger } from '../../shadcn/popover.js';
import { Separator } from '../../shadcn/separator.js';
import { Badge } from '../badge.js';

interface DataGridColumnFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  title?: string;
  options: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
}

type DataGridColumnFilterOption = {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
};

function DataGridColumnFilterRow<TData, TValue>({
  column,
  option,
  isSelected,
  selectedValues,
  count,
}: {
  column?: Column<TData, TValue>;
  option: DataGridColumnFilterOption;
  isSelected: boolean;
  selectedValues: Set<string>;
  count?: number;
}) {
  const handleClick = useCallback(() => {
    if (isSelected) {
      selectedValues.delete(option.value);
    } else {
      selectedValues.add(option.value);
    }
    const filterValues = Array.from(selectedValues);
    column?.setFilterValue(filterValues.length ? filterValues : undefined);
  }, [column, isSelected, option.value, selectedValues]);

  return (
    <div
      onClick={handleClick}
      className={cn(
        'relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none',
        'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
      )}>
      <div
        className={cn(
          'border-primary me-2 flex h-4 w-4 items-center justify-center rounded-sm border',
          isSelected ? 'bg-primary text-primary-foreground' : 'opacity-50 [&_svg]:invisible',
        )}>
        <CheckIcon className="h-4 w-4" />
      </div>
      {option.icon && <option.icon className="text-muted-foreground me-2 h-4 w-4" />}
      <span>{option.label}</span>
      {count !== undefined && count !== 0 && (
        <span className="ms-auto flex h-4 w-4 items-center justify-center font-mono text-xs">
          {count}
        </span>
      )}
    </div>
  );
}

function DataGridColumnFilter<TData, TValue>({
  column,
  title,
  options,
}: DataGridColumnFilterProps<TData, TValue>) {
  const facets = column?.getFacetedUniqueValues();
  const selectedValues = new Set(column?.getFilterValue() as string[]);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value),
    [],
  );
  const handleClearFilter = useCallback(() => column?.setFilterValue(undefined), [column]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    return options.filter(option => option.label.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [options, searchQuery]);

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        <CirclePlusIcon className="size-4" />
        {title}
        {selectedValues?.size > 0 && (
          <>
            <Separator orientation="vertical" className="mx-2 h-4" />
            <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
              {selectedValues.size}
            </Badge>
            <div className="hidden space-x-1 rtl:space-x-reverse lg:flex">
              {selectedValues.size > 2 ? (
                <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                  {selectedValues.size} selected
                </Badge>
              ) : (
                options
                  .filter(option => selectedValues.has(option.value))
                  .map(option => (
                    <Badge
                      variant="secondary"
                      key={option.value}
                      className="rounded-sm px-1 font-normal">
                      {option.label}
                    </Badge>
                  ))
              )}
            </div>
          </>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <div className="p-2">
          <Input
            placeholder={title}
            value={searchQuery}
            onChange={handleSearchChange}
            className="h-8"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="text-muted-foreground py-6 text-center text-sm">No results found.</div>
          ) : (
            <div className="p-1">
              {filteredOptions.map(option => (
                <DataGridColumnFilterRow
                  key={option.value}
                  column={column}
                  option={option}
                  isSelected={selectedValues.has(option.value)}
                  selectedValues={selectedValues}
                  count={facets?.get(option.value)}
                />
              ))}
            </div>
          )}
          {selectedValues.size > 0 && (
            <>
              <div className="bg-border -mx-1 my-1 h-px" />
              <div className="p-1">
                <div
                  onClick={handleClearFilter}
                  className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center justify-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none">
                  Clear filters
                </div>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DataGridColumnFilter, type DataGridColumnFilterProps };
