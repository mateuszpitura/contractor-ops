import { countryFieldsSchemaMap } from '@contractor-ops/validators';
import type { z } from 'zod';

type CountryCode = keyof typeof countryFieldsSchemaMap;

type SchemaDrivenComplianceFieldsProps = {
  countryCode: CountryCode;
  values: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
  disabled?: boolean;
};

/**
 * Renders compliance field keys from validators country-fields schema.
 * Replaces per-country *-compliance-fields.tsx proliferation incrementally.
 */
export function SchemaDrivenComplianceFields({
  countryCode,
  values,
  onChange,
  disabled,
}: SchemaDrivenComplianceFieldsProps) {
  const schema = countryFieldsSchemaMap[countryCode];
  if (!schema) return null;

  const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
  const keys = Object.keys(shape);

  return (
    <div className="space-y-4">
      {keys.map(key => (
        <label key={key} className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{key}</span>
          <input
            type="text"
            className="rounded-md border px-3 py-2"
            value={String(values[key] ?? '')}
            disabled={disabled}
            onChange={e => onChange(key, e.target.value)}
          />
        </label>
      ))}
    </div>
  );
}
