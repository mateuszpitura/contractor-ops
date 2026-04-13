'use client';

import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { EntityType } from './import-wizard-dialog';

// ---------------------------------------------------------------------------
// Target field definitions
// ---------------------------------------------------------------------------

interface TargetField {
  key: string;
  label: string;
  required: boolean;
}

const CONTRACTOR_FIELDS: TargetField[] = [
  { key: 'legalName', label: 'Legal Name', required: true },
  { key: 'displayName', label: 'Display Name', required: false },
  { key: 'taxId', label: 'Tax ID (NIP)', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'type', label: 'Type', required: false },
  { key: 'vatId', label: 'VAT ID', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'countryCode', label: 'Country Code', required: false },
  { key: 'currency', label: 'Currency', required: false },
];

const CONTRACT_FIELDS: TargetField[] = [
  { key: 'title', label: 'Title', required: true },
  { key: 'type', label: 'Type', required: true },
  { key: 'startDate', label: 'Start Date', required: true },
  { key: 'endDate', label: 'End Date', required: false },
  { key: 'contractorTaxId', label: 'Contractor Tax ID', required: true },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface StepMappingProps {
  headers: string[];
  sampleRows: Record<string, string>[];
  suggestedMapping: Record<string, string | null>;
  entityType: EntityType;
  columnMapping: Record<string, string | null>;
  onMappingChange: (mapping: Record<string, string | null>) => void;
}

export function StepMapping({
  headers,
  sampleRows,
  suggestedMapping,
  entityType,
  columnMapping,
  onMappingChange,
}: StepMappingProps) {
  const t = useTranslations('Import');
  const tAria = useTranslations('Common.aria');

  const targetFields = entityType === 'contractor' ? CONTRACTOR_FIELDS : CONTRACT_FIELDS;

  // Track which target fields are already mapped
  const usedTargets = useMemo(() => {
    const used = new Set<string>();
    for (const [, target] of Object.entries(columnMapping)) {
      if (target) used.add(target);
    }
    return used;
  }, [columnMapping]);

  const handleMappingChange = (header: string, value: string) => {
    const newMapping = { ...columnMapping };
    if (value === '__skip__') {
      newMapping[header] = null;
    } else {
      newMapping[header] = value;
    }
    onMappingChange(newMapping);
  };

  const getSampleValue = (header: string): string => {
    for (const row of sampleRows) {
      const val = row[header];
      if (val && val.trim() !== '') return val;
    }
    return '';
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('mapping.description')}</p>

      {/* Mapping grid */}
      <div className="space-y-2">
        {headers.map(header => {
          const currentTarget = columnMapping[header];
          const _isAutoMatched =
            suggestedMapping[header] !== null &&
            suggestedMapping[header] !== undefined &&
            currentTarget === suggestedMapping[header];
          const isMapped = currentTarget !== null && currentTarget !== undefined;
          const sample = getSampleValue(header);

          return (
            <div
              key={header}
              className="grid grid-cols-[2fr_3fr] items-center gap-3 rounded-md border bg-muted/20 p-3">
              {/* Source column */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {isMapped ? (
                    <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle aria-hidden="true" className="size-4 shrink-0 text-amber-500" />
                  )}
                  <span className="truncate text-sm font-medium">{header}</span>
                </div>
                {sample && (
                  <p className="mt-0.5 truncate ps-6 text-xs text-muted-foreground">{sample}</p>
                )}
              </div>

              {/* Target field select */}
              <Select
                value={currentTarget ?? '__skip__'}
                // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                onValueChange={val => handleMappingChange(header, val ?? '__skip__')}
                aria-label={tAria('mapColumnToField', { header })}>
                <SelectTrigger className="w-full" aria-label={tAria('mapTo', { header })}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__skip__">{t('mapping.skip')}</SelectItem>
                  {targetFields.map(field => {
                    const isUsedByOther = usedTargets.has(field.key) && currentTarget !== field.key;

                    return (
                      <SelectItem key={field.key} value={field.key} disabled={isUsedByOther}>
                        {field.label}
                        {field.required ? ' *' : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <p className="text-xs text-muted-foreground">{t('mapping.note')}</p>
    </div>
  );
}
