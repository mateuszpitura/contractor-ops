'use client';

import type { BundeslandCode } from '@contractor-ops/validators';
import { STEUERNUMMER_FORMATS } from '@contractor-ops/validators';
import { useId, useMemo } from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface BundeslandSelectProps {
  value: BundeslandCode | undefined;
  onChange: (code: BundeslandCode) => void;
  label: string;
  error?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * 16-Bundesland &lt;select&gt; rendered alphabetically by German name.
 *
 * Uses a native `<select>` rather than a portaled combobox so the entire option
 * set is present in the accessibility tree without the user having to open the
 * listbox — this matches the WCAG-AA contract in UI-SPEC §2 (Bundesland UX) and
 * preserves keyboard (↑/↓/type-ahead) and screen-reader semantics via the
 * browser. The underlying form value is the two-letter Bundesland code
 * (e.g. `BW`), while the visible label is the canonical German name.
 */
export function BundeslandSelect({
  value,
  onChange,
  label,
  error,
  id,
  required = false,
  disabled = false,
}: BundeslandSelectProps) {
  const reactId = useId();
  const selectId = id ?? `bundesland-${reactId}`;
  const errorId = `${selectId}-error`;

  const sorted = useMemo(
    () => [...STEUERNUMMER_FORMATS].sort((a, b) => a.germanName.localeCompare(b.germanName, 'de')),
    [],
  );

  return (
    <div className="space-y-2">
      <Label htmlFor={selectId} className="text-sm font-medium">
        {label}
        {required ? (
          <span aria-hidden="true" className="ms-1 text-destructive">
            *
          </span>
        ) : null}
      </Label>
      <select
        id={selectId}
        dir="ltr"
        value={value ?? sorted[0]?.code ?? ''}
        defaultValue={undefined}
        required={required}
        aria-required={required ? 'true' : undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        disabled={disabled}
        // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
        onChange={e => {
          const next = e.target.value as BundeslandCode | '';
          if (next !== '') onChange(next);
        }}
        className={cn(
          'h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-destructive ring-2 ring-destructive/20',
        )}>
        {sorted.map(format => (
          <option key={format.code} value={format.code} title={format.germanName}>
            {format.germanName}
          </option>
        ))}
      </select>
      {error ? (
        <p id={errorId} role="alert" aria-live="polite" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
