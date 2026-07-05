import { toCsvBuffer } from '../../lib/csv-writer.js';
import { cf, isoDate, splitName } from '../../lib/format.js';
import type { PayrollFeed } from '../../types/feed.js';

// Comarch ERP Optima "Płace" employee-import column contract. Locked by a golden
// fixture; vendor/statutory correctness is a deferred adviser-verify checkpoint.
export const COMARCH_COLUMNS = [
  'Nazwisko',
  'Imie',
  'PESEL',
  'KodStanowiska',
  'DataPrzyjecia',
  'DataZwolnienia',
  'WymiarEtatu',
  'UrzadSkarbowy',
  'KodUbezpieczenia',
  'StawkaMiesieczna',
] as const;

export async function generateComarchCsv(feed: PayrollFeed): Promise<Buffer> {
  const rows = feed.employees.map(e => {
    const { firstNames, surname } = splitName(e.displayName);
    return [
      surname,
      firstNames,
      e.nationalIdLast4 ?? '',
      cf(e, 'stanowisko'),
      isoDate(e.hireDate),
      isoDate(e.terminatedAt),
      e.etat ?? '',
      cf(e, 'urzadSkarbowyCode'),
      cf(e, 'zusTitleCode'),
      cf(e, 'stawkaBrutto'),
    ];
  });
  return toCsvBuffer([...COMARCH_COLUMNS], rows, ';');
}
