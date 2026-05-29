/**
 * Origin-style phone number input with country-code selector + E.164 emission.
 *
 * Stands in for `@origin/phone-number-input` since originui.com redirected
 * to coss.com/ui without a stable `/r/*` JSON registry (probed 2026-05-26).
 * Matches the originui pattern: searchable country combobox, dial-code
 * prefix, numeric national-number input, E.164 stringification.
 */
import * as React from 'react';

import { cn } from '../../lib/utils.js';
import { Combobox } from '../reui/combobox.js';

export interface Country {
  iso2: string;
  name: string;
  dialCode: string;
}

const DEFAULT_COUNTRIES: readonly Country[] = [
  { iso2: 'PL', name: 'Poland', dialCode: '+48' },
  { iso2: 'DE', name: 'Germany', dialCode: '+49' },
  { iso2: 'GB', name: 'United Kingdom', dialCode: '+44' },
  { iso2: 'FR', name: 'France', dialCode: '+33' },
  { iso2: 'IT', name: 'Italy', dialCode: '+39' },
  { iso2: 'ES', name: 'Spain', dialCode: '+34' },
  { iso2: 'NL', name: 'Netherlands', dialCode: '+31' },
  { iso2: 'AE', name: 'United Arab Emirates', dialCode: '+971' },
  { iso2: 'SA', name: 'Saudi Arabia', dialCode: '+966' },
  { iso2: 'US', name: 'United States', dialCode: '+1' },
];

export interface PhoneNumberInputProps {
  value: string;
  onValueChange: (e164: string) => void;
  countries?: readonly Country[];
  defaultCountryIso2?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
  id?: string;
}

function isE164(value: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(value);
}

function splitE164(
  value: string,
  countries: readonly Country[],
): {
  country: Country;
  national: string;
} {
  if (value.startsWith('+')) {
    const sorted = [...countries].sort((a, b) => b.dialCode.length - a.dialCode.length);
    for (const country of sorted) {
      if (value.startsWith(country.dialCode)) {
        return { country, national: value.slice(country.dialCode.length) };
      }
    }
  }
  return { country: countries[0], national: value.replace(/^\+\d+/, '') };
}

export function PhoneNumberInput({
  value,
  onValueChange,
  countries = DEFAULT_COUNTRIES,
  defaultCountryIso2 = 'PL',
  placeholder = '600 000 000',
  className,
  disabled = false,
  'aria-label': ariaLabel = 'Phone number',
  id,
}: PhoneNumberInputProps) {
  const initial = React.useMemo(() => {
    if (value && isE164(value)) return splitE164(value, countries);
    return {
      country: countries.find(c => c.iso2 === defaultCountryIso2) ?? countries[0],
      national: value ?? '',
    };
  }, [countries, defaultCountryIso2, value]);

  const [country, setCountry] = React.useState<Country>(initial.country);
  const [national, setNational] = React.useState<string>(initial.national);

  const emit = React.useCallback(
    (nextCountry: Country, nextNational: string) => {
      const digits = nextNational.replace(/[^\d]/g, '');
      const e164 = digits ? `${nextCountry.dialCode}${digits}` : '';
      onValueChange(e164);
    },
    [onValueChange],
  );

  const countryOptions = React.useMemo(
    () => countries.map(c => ({ value: c.iso2, label: `${c.name} (${c.dialCode})` })),
    [countries],
  );

  const handleCountryChange = React.useCallback(
    (iso: string) => {
      const next = countries.find(c => c.iso2 === iso) ?? country;
      setCountry(next);
      emit(next, national);
    },
    [countries, country, emit, national],
  );

  const handleNationalChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setNational(next);
      emit(country, next);
    },
    [country, emit],
  );

  return (
    <div className={cn('flex gap-2', className)}>
      <div className="w-44 shrink-0">
        <Combobox
          options={countryOptions}
          value={country.iso2}
          onValueChange={handleCountryChange}
          placeholder="Country"
          searchPlaceholder="Search countries..."
          disabled={disabled}
        />
      </div>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={national}
        onChange={handleNationalChange}
        placeholder={placeholder}
        disabled={disabled}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}
