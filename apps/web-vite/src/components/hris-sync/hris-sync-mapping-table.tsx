import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { useState } from 'react';

import type { useTranslations } from '../../i18n/useTranslations.js';

type StandardMapping = {
  displayName?: string;
  email?: string;
  position?: string;
  department?: string;
  employmentStatus?: string;
  hireDate?: string;
  terminatedAt?: string;
};

interface HrisSyncMappingTableProps {
  t: ReturnType<typeof useTranslations>;
  mapping: StandardMapping;
  busy: boolean;
  onSave: (mapping: StandardMapping) => void;
}

const FIELDS: Array<keyof StandardMapping> = [
  'displayName',
  'email',
  'position',
  'department',
  'employmentStatus',
  'hireDate',
  'terminatedAt',
];

/**
 * Presentational standard-field mapping editor: for each CO registry field the
 * admin types the HRIS attribute name that feeds it.
 */
export function HrisSyncMappingTable({ t, mapping, busy, onSave }: HrisSyncMappingTableProps) {
  const [draft, setDraft] = useState<StandardMapping>(mapping);

  return (
    <form
      className="space-y-4 rounded-lg border bg-card p-5"
      onSubmit={event => {
        event.preventDefault();
        const cleaned: StandardMapping = {};
        for (const field of FIELDS) {
          const value = draft[field]?.trim();
          if (value) cleaned[field] = value;
        }
        onSave(cleaned);
      }}>
      <div className="space-y-1">
        <p className="text-sm font-medium">{t('mapping.heading')}</p>
        <p className="text-xs text-muted-foreground">{t('mapping.description')}</p>
      </div>

      <div className="space-y-3">
        {FIELDS.map(field => (
          <label
            key={field}
            className="grid grid-cols-1 items-center gap-1 sm:grid-cols-3 sm:gap-3">
            <span className="text-xs font-medium">{t(`mapping.fields.${field}`)}</span>
            <input
              className="col-span-2 rounded-md border bg-background px-3 py-2 text-sm"
              value={draft[field] ?? ''}
              onChange={event => setDraft(prev => ({ ...prev, [field]: event.target.value }))}
              placeholder={t('mapping.attrPlaceholder')}
              autoComplete="off"
            />
          </label>
        ))}
      </div>

      <Button type="submit" disabled={busy}>
        {t('actions.saveMapping')}
      </Button>
    </form>
  );
}
