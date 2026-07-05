import { toCsvBuffer } from '../../lib/csv-writer.js';
import { cf, isoDate, splitName } from '../../lib/format.js';
import type { PayrollFeed } from '../../types/feed.js';

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

export async function generateSageDeCsv(feed: PayrollFeed): Promise<Buffer> {
  const rows = feed.employees.map(e => {
    const { firstNames, surname } = splitName(e.displayName);
    const kinderfreibetrag = cf(e, 'kinderfreibetrag');
    return [
      surname,
      firstNames,
      cf(e, 'lohnsteuerklasse'),
      cf(e, 'kirchensteuer'),
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
