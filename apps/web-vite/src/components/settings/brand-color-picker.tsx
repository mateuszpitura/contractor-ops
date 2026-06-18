import { Input } from '@contractor-ops/ui/components/shadcn/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import { Check } from 'lucide-react';
import type * as React from 'react';
import { useCallback, useState } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { cn } from '../../lib/utils';

// ---------------------------------------------------------------------------
// Preset swatches (UI-SPEC: 8 colors in 4x2 grid)
// ---------------------------------------------------------------------------

const SWATCHES = [
  { label: 'Slate', hex: '#475569' },
  { label: 'Red', hex: '#dc2626' },
  { label: 'Orange', hex: '#ea580c' },
  { label: 'Amber', hex: '#d97706' },
  { label: 'Green', hex: '#16a34a' },
  { label: 'Blue', hex: '#2563eb' },
  { label: 'Indigo', hex: '#4f46e5' },
  { label: 'Violet', hex: '#7c3aed' },
] as const;

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BrandColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

interface SwatchButtonProps {
  hex: string;
  label: string;
  isSelected: boolean;
  ariaLabel: string;
  onSelect: (hex: string) => void;
}

function SwatchButton({ hex, isSelected, ariaLabel, onSelect }: SwatchButtonProps) {
  const handleClick = useCallback(() => onSelect(hex), [onSelect, hex]);
  return (
    <button
      type="button"
      // biome-ignore lint/nursery/noInlineStyles: dynamic swatch color
      style={{ backgroundColor: hex }}
      className={cn(
        'relative h-8 w-8 rounded-md transition-all',
        isSelected && 'ring-2 ring-offset-2 ring-primary',
      )}
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-pressed={isSelected}>
      {isSelected ? (
        <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-sm" />
      ) : null}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Brand color picker with 8 preset swatches + hex input.
 * Uses Popover from shadcn/ui. Trigger is a small color swatch button.
 */
export function BrandColorPicker({ value, onChange }: BrandColorPickerProps) {
  const tAria = useTranslations('Common.aria');
  const t = useTranslations('Settings.branding');
  const [hexInput, setHexInput] = useState(value);
  const [open, setOpen] = useState(false);

  const handleSwatchClick = useCallback(
    (hex: string) => {
      setHexInput(hex);
      onChange(hex);
      setOpen(false);
    },
    [onChange],
  );

  const handleHexChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const val = raw.startsWith('#') ? raw : `#${raw}`;
      setHexInput(val);
      if (HEX_REGEX.test(val)) {
        onChange(val);
      }
    },
    [onChange],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="h-6 w-6 rounded-md border border-input shadow-sm transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            // biome-ignore lint/nursery/noInlineStyles: dynamic user-chosen brand color
            style={{ backgroundColor: value }}
            aria-label={tAria('selectedColor', { value })}
          />
        }
      />
      <PopoverContent align="start" className="w-auto p-3">
        {/* Swatch grid: 4x2 */}
        <div className="grid grid-cols-4 gap-2">
          {SWATCHES.map(swatch => (
            <SwatchButton
              key={swatch.hex}
              hex={swatch.hex}
              label={swatch.label}
              isSelected={value.toLowerCase() === swatch.hex.toLowerCase()}
              ariaLabel={tAria('colorSwatch', { label: swatch.label, hex: swatch.hex })}
              onSelect={handleSwatchClick}
            />
          ))}
        </div>

        {/* Hex input */}
        <div className="mt-3">
          <Input
            value={hexInput}
            onChange={handleHexChange}
            placeholder={t('colorPlaceholder')}
            className="h-8 font-mono text-sm"
            maxLength={7}
            aria-label={tAria('hexColorCode')}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
