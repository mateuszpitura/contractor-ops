'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Brand color picker with 8 preset swatches + hex input.
 * Uses Popover from shadcn/ui. Trigger is a small color swatch button.
 */
export function BrandColorPicker({ value, onChange }: BrandColorPickerProps) {
  const tAria = useTranslations('Common.aria');
  const [hexInput, setHexInput] = useState(value);
  const [open, setOpen] = useState(false);

  const handleSwatchClick = (hex: string) => {
    setHexInput(hex);
    onChange(hex);
    setOpen(false);
  };

  const handleHexChange = (raw: string) => {
    // Ensure # prefix
    const val = raw.startsWith('#') ? raw : `#${raw}`;
    setHexInput(val);
    if (HEX_REGEX.test(val)) {
      onChange(val);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="h-6 w-6 rounded-md border border-input shadow-sm transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={tAria('selectedColor', { value })}
          />
        }
      />
      <PopoverContent align="start" className="w-auto p-3">
        {/* Swatch grid: 4x2 */}
        <div className="grid grid-cols-4 gap-2">
          {SWATCHES.map(swatch => {
            const isSelected = value.toLowerCase() === swatch.hex.toLowerCase();
            return (
              <button
                key={swatch.hex}
                type="button"
                className={cn(
                  'relative h-8 w-8 rounded-md transition-all',
                  isSelected && 'ring-2 ring-offset-2 ring-primary',
                )}
                onClick={() => handleSwatchClick(swatch.hex)}
                aria-label={tAria('colorSwatch', { label: swatch.label, hex: swatch.hex })}
                aria-pressed={isSelected}>
                {isSelected && (
                  <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-sm" />
                )}
              </button>
            );
          })}
        </div>

        {/* Hex input */}
        <div className="mt-3">
          <Input
            value={hexInput}
            onChange={e => handleHexChange(e.target.value)}
            placeholder="#4f46e5"
            className="h-8 font-mono text-sm"
            maxLength={7}
            aria-label={tAria('hexColorCode')}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
