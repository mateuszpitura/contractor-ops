import { Label } from '@contractor-ops/ui/components/shadcn/label';
import type { BundeslandCode } from '@contractor-ops/validators';
import { STEUERNUMMER_FORMATS } from '@contractor-ops/validators';
import { useCallback, useId, useMemo } from 'react';

import { cn } from '../../../lib/utils.js';

export interface BundeslandSelectProps {
  value: BundeslandCode | undefined;
  onChange: (code: BundeslandCode) => void;
  label: string;
  error?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
}

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

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const next = e.target.value as BundeslandCode | '';
      if (next !== '') onChange(next);
    },
    [onChange],
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
        onChange={handleChange}
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
