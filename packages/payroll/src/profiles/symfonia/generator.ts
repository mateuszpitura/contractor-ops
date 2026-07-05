import { toCsvBuffer } from '../../lib/csv-writer.js';
import { cf, escapeXml, isoDate, splitName } from '../../lib/format.js';
import type { PayrollFeed, PayrollFeedEmployee } from '../../types/feed.js';
import { SYMFONIA_COLUMNS, SYMFONIA_XML_RECORD, SYMFONIA_XML_ROOT } from './constants.js';

/** Project one feed employee onto the pinned Symfonia field order. */
function symfoniaRow(e: PayrollFeedEmployee): string[] {
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
    cf(e, 'nfzOddzial'),
    cf(e, 'stawkaBrutto'),
  ];
}

export async function generateSymfoniaCsv(feed: PayrollFeed): Promise<Buffer> {
  const rows = feed.employees.map(symfoniaRow);
  return toCsvBuffer([...SYMFONIA_COLUMNS], rows, ';');
}

export function generateSymfoniaXml(feed: PayrollFeed): Buffer {
  const records = feed.employees.map(e => {
    const values = symfoniaRow(e);
    const fields = SYMFONIA_COLUMNS.map(
      (col, i) => `<${col}>${escapeXml(values[i] ?? '')}</${col}>`,
    ).join('');
    return `<${SYMFONIA_XML_RECORD}>${fields}</${SYMFONIA_XML_RECORD}>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<${SYMFONIA_XML_ROOT}>\n${records.join('\n')}\n</${SYMFONIA_XML_ROOT}>\n`;
  return Buffer.from(xml, 'utf8');
}
