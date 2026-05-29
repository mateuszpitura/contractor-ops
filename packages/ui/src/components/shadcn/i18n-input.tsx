'use client';

import type { HTMLProps } from '@base-ui/react';
import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { cn } from '../../lib/utils.js';
import { Input } from './input.js';
import { Popover, PopoverContent, PopoverTrigger } from './popover.js';

// ---------------------------------------------------------------------------
// Locale → flag asset + display label
// ---------------------------------------------------------------------------

const LOCALE_TO_FLAG: Record<string, { flag: string; label: string }> = {
  en: { flag: '/flags/gb.svg', label: 'EN' },
  pl: { flag: '/flags/pl.svg', label: 'PL' },
  de: { flag: '/flags/de.svg', label: 'DE' },
  ar: { flag: '/flags/sa.svg', label: 'AR' },
};

function flagFor(locale: string) {
  return LOCALE_TO_FLAG[locale] ?? { flag: '/flags/gb.svg', label: locale.toUpperCase() };
}

interface LocaleListItemButtonProps {
  locale: string;
  meta: { flag: string; label: string };
  filled: boolean;
  isActive: boolean;
  onSelect: (locale: string) => void;
}

function LocaleListItemButton({
  locale,
  meta,
  filled,
  isActive,
  onSelect,
}: LocaleListItemButtonProps) {
  const handleClick = useCallback(() => onSelect(locale), [onSelect, locale]);
  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent',
        isActive && 'bg-accent/60 font-medium',
      )}>
      {/** biome-ignore lint/performance/noImgElement: small static svg under /public */}
      <img
        src={meta.flag}
        alt=""
        aria-hidden="true"
        className="h-3.5 w-5 rounded-sm object-cover"
      />
      <span className="flex-1 text-start">{meta.label}</span>
      <span
        data-filled={filled ? 'true' : 'false'}
        aria-label={filled ? 'translated' : 'empty'}
        className={cn(
          'h-2 w-2 rounded-full border',
          filled ? 'border-primary bg-primary' : 'border-muted-foreground/40 bg-transparent',
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface I18nInputProps {
  /** Map of locale → value. Missing locales render as empty. */
  value: Record<string, string>;
  /** Called with the next full map after editing the active locale. */
  onChange: (next: Record<string, string>) => void;
  /** Locales the input cycles through (ordered). */
  locales: readonly string[];
  /** Locale displayed first when nothing is selected; defaults to `locales[0]`. */
  defaultLocale?: string;
  /** Placeholder forwarded to the inner `<Input>`. */
  placeholder?: string;
  /** Forwarded to inner `<Input>` for form integration (label / aria-describedby). */
  id?: string;
  /** Disabled state propagates to input + adornment. */
  disabled?: boolean;
  /** Extra classes applied to the wrapper. */
  className?: string;
  inputProps?: Omit<
    ComponentProps<typeof Input>,
    'value' | 'onChange' | 'placeholder' | 'id' | 'disabled'
  >;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Single-input multilingual editor. Replaces the older "stack one input per
 * locale" pattern with a single text field plus a flag-dropdown adornment.
 * The dropdown lists every supported locale with a fill dot indicating
 * whether that locale already has a value, so editors can see at a glance
 * which translations are still missing.
 *
 * The component is fully controlled: it never holds the value map itself —
 * the parent owns `{ [locale]: string }` and re-renders on each keystroke.
 */
export function I18nInput({
  value,
  onChange,
  locales,
  defaultLocale,
  placeholder,
  id,
  disabled,
  className,
  inputProps,
}: I18nInputProps) {
  const initialLocale =
    defaultLocale && locales.includes(defaultLocale) ? defaultLocale : locales[0];
  const [activeLocale, setActiveLocale] = useState<string>(initialLocale ?? 'en');
  const [open, setOpen] = useState(false);

  const activeMeta = flagFor(activeLocale);
  const activeValue = value[activeLocale] ?? '';

  const filledMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const loc of locales) {
      map[loc] = (value[loc] ?? '').trim().length > 0;
    }
    return map;
  }, [locales, value]);

  const handleChange = useCallback(
    (next: string) => {
      onChange({ ...value, [activeLocale]: next });
    },
    [activeLocale, onChange, value],
  );

  const handleSelectLocale = useCallback((locale: string) => {
    setActiveLocale(locale);
    setOpen(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => handleChange(e.target.value),
    [handleChange],
  );

  const renderLocaleTrigger = useCallback(
    (props: HTMLProps<HTMLButtonElement>) => (
      <button
        {...props}
        type="button"
        disabled={disabled}
        className="absolute inset-y-0 end-1 my-auto inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`Switch language (current: ${activeMeta.label})`}>
        {/** biome-ignore lint/performance/noImgElement: small static svg under /public */}
        <img
          src={activeMeta.flag}
          alt=""
          aria-hidden="true"
          className="h-3.5 w-5 rounded-sm object-cover"
        />
        <span>{activeMeta.label}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
    ),
    [disabled, activeMeta.flag, activeMeta.label],
  );

  return (
    <div className={cn('relative flex items-stretch', className)}>
      <Input
        id={id}
        value={activeValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        className="pe-24"
        {...inputProps}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={renderLocaleTrigger} />
        <PopoverContent align="end" className="w-44 p-1">
          <ul className="space-y-0.5">
            {locales.map(loc => {
              const meta = flagFor(loc);
              const filled = filledMap[loc];
              const isActive = loc === activeLocale;
              return (
                <li key={loc}>
                  <LocaleListItemButton
                    locale={loc}
                    meta={meta}
                    filled={Boolean(filled)}
                    isActive={isActive}
                    onSelect={handleSelectLocale}
                  />
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}
