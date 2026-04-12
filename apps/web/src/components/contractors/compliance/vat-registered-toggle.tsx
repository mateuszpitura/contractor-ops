'use client';

import { useId } from 'react';

import { Switch } from '@/components/ui/switch';

export interface VatRegisteredToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id?: string;
}

/**
 * shadcn `Switch` bound to a visible sibling text node via `aria-labelledby`.
 *
 * Used for the UK `isVatRegistered` flag and the DE `isKleinunternehmer` /
 * `isVatRegistered` flags. Exposes its accessible name through
 * `aria-labelledby` (pointing at the visible `<span>` to its right) rather
 * than a `<label htmlFor>` / Label pairing — this keeps form-field lookups
 * (`getByLabelText`) scoped to the real input fields (UTR, VAT reg number,
 * USt-IdNr, etc.) instead of picking up this toggle when callers search for
 * adjacent tax terms.
 *
 * Clicking the visible text node still toggles the switch because the
 * wrapping `<label>`-like container delegates pointer events via the
 * `htmlFor`-style `onClick` on the container. Keyboard access uses the
 * Switch's own focus ring + Space/Enter handling.
 */
export function VatRegisteredToggle({
  checked,
  onChange,
  label,
  id,
}: VatRegisteredToggleProps): JSX.Element {
  const reactId = useId();
  const switchId = id ?? `vat-toggle-${reactId}`;
  const textId = `${switchId}-text`;

  return (
    <div className="flex items-center gap-2">
      <Switch
        id={switchId}
        checked={checked}
        onCheckedChange={onChange}
        aria-labelledby={textId}
      />
      <span
        id={textId}
        className="text-sm font-medium select-none"
        onClick={() => onChange(!checked)}>
        {label}
      </span>
    </div>
  );
}
