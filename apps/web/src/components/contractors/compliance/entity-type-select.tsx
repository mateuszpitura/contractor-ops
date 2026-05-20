'use client';

import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { useId } from 'react';
import { cn } from '@/lib/utils';

export interface EntityTypeSelectProps<T extends string> {
  values: readonly T[];
  value: T | undefined;
  onChange: (v: T) => void;
  label: string;
  error?: string;
  renderOption: (v: T) => string;
  id?: string;
  required?: boolean;
}

/**
 * Generic entity-type selector.
 *
 * Rendered as a native `<select>` so the complete option set participates in
 * the accessibility tree immediately (important for automated tests and for
 * screen-reader keyboard walkthroughs). The caller supplies the option set
 * (e.g. `ukEntityTypeEnum.options`) along with a `renderOption` pure function
 * that maps code → human label, allowing locale-aware or styled labels without
 * forcing this primitive to know about i18n.
 */
export function EntityTypeSelect<T extends string>({
  values,
  value,
  onChange,
  label,
  error,
  renderOption,
  id,
  required = false,
}: EntityTypeSelectProps<T>) {
  const reactId = useId();
  const selectId = id ?? `entity-type-${reactId}`;
  const errorId = `${selectId}-error`;

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
        value={value ?? ''}
        required={required}
        aria-required={required ? 'true' : undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
        onChange={e => {
          const next = e.target.value;
          if (next !== '') onChange(next as T);
        }}
        className={cn(
          'h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-destructive ring-2 ring-destructive/20',
        )}>
        <option value="" disabled>
          —
        </option>
        {values.map(v => (
          <option key={v} value={v}>
            {renderOption(v)}
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
