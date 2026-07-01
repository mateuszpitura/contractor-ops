import type { ComboboxOption } from '@contractor-ops/ui/components/reui/combobox';
import { Combobox } from '@contractor-ops/ui/components/reui/combobox';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { useId } from 'react';

export interface ReferenceListPickerProps {
  label: string;
  value: string | null;
  onValueChange: (value: string) => void;
  options: readonly ComboboxOption[];
  searchPlaceholder: string;
  emptyLabel: string;
  placeholder?: string;
  /**
   * Adviser-verify note for statutory seed lists — rendered as a muted dashed
   * box beneath the picker so the "confirm with a local payroll adviser" caveat
   * travels with the field. Omit when the list needs no caveat.
   */
  adviserNote?: string;
}

/**
 * Keyboard-navigable picker over a seeded statutory reference list (NFZ
 * branches, ZUS offices, urząd skarbowy, Krankenkasse). Wraps the shared
 * combobox so results are announced and filterable, and carries the
 * adviser-verify note for lists that are stable but not authoritative.
 */
export function ReferenceListPicker({
  label,
  value,
  onValueChange,
  options,
  searchPlaceholder,
  emptyLabel,
  placeholder,
  adviserNote,
}: ReferenceListPickerProps) {
  const id = useId();

  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}-picker`} className="text-sm font-medium">
        {label}
      </Label>
      <Combobox
        options={options}
        value={value}
        onValueChange={onValueChange}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyLabel={emptyLabel}
      />
      {adviserNote ? (
        <p className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
          {adviserNote}
        </p>
      ) : null}
    </div>
  );
}
