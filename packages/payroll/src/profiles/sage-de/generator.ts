import { createLogger } from '@contractor-ops/logger';
import { toCsvBuffer } from '../../lib/csv-writer.js';
import { cf, isoDate, splitName } from '../../lib/format.js';
import type { PayrollFeed } from '../../types/feed.js';

const log = createLogger({ module: 'payroll/sage-de-generator' });

// Sage HR / Personalwirtschaft (DE) employee-import column contract. UTF-8 CSV
// (umlauts preserved, unlike the ASCII DATEV file). Locked by a golden fixture;
// vendor/statutory correctness is a deferred adviser-verify checkpoint.
export const SAGE_DE_COLUMNS = [
  'Nachname',
  'Vorname',
  'Steuerklasse',
  'Kirchensteuer',
  'SteuerIdNr',
  'SvNummer',
  'Krankenkasse',
  'Kinderfreibetrag',
  'Eintrittsdatum',
  'Austrittsdatum',
] as const;

function sageKirchensteuerLabel(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '';
  if (typeof raw === 'boolean') {
    // Legacy boolean carries no confession — never guess a code; export blank until migrated.
    if (raw)
      log.warn('kirchensteuer legacy boolean=true exported blank; migrate to confession code');
    return '';
  }
  if (typeof raw === 'string') return raw;
  return '';
}

export async function generateSageDeCsv(feed: PayrollFeed): Promise<Buffer> {
  const rows = feed.employees.map(e => {
    const { firstNames, surname } = splitName(e.displayName);
    const kinderfreibetrag = cf(e, 'kinderfreibetrag');
    return [
      surname,
      firstNames,
      cf(e, 'lohnsteuerklasse'),
      sageKirchensteuerLabel(e.countryFields.kirchensteuer),
      cf(e, 'steuerIdNr'),
      cf(e, 'svNummer'),
      cf(e, 'krankenkasse'),
      kinderfreibetrag ? Number(kinderfreibetrag).toFixed(2) : '',
      isoDate(e.hireDate),
      isoDate(e.terminatedAt),
    ];
  });
  return toCsvBuffer([...SAGE_DE_COLUMNS], rows, ';');
}
