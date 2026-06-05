import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import { useId } from 'react';

export interface VatRegisteredToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id?: string;
}

export function VatRegisteredToggle({ checked, onChange, label, id }: VatRegisteredToggleProps) {
  const reactId = useId();
  const switchId = id ?? `vat-toggle-${reactId}`;
  const textId = `${switchId}-text`;

  return (
    <div className="flex items-center gap-2">
      <Switch id={switchId} checked={checked} onCheckedChange={onChange} aria-labelledby={textId} />
      <label
        id={textId}
        htmlFor={switchId}
        className="text-sm font-medium select-none cursor-pointer">
        {label}
      </label>
    </div>
  );
}
