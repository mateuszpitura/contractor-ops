import { createLogger } from '@contractor-ops/logger';
import { cf, compactDate, splitName, transliterateDe } from '../../lib/format.js';
import type { PayrollFeed, PayrollFeedEmployee } from '../../types/feed.js';

const log = createLogger({ module: 'payroll/datev-generator' });

import {
  DATEV_FIELDS,
  DATEV_FORMAT_MARKER,
  DATEV_FORMAT_VERSION,
  DATEV_MODULE,
  DATEV_PRODUCT,
  DATEV_RECORD_LENGTH,
} from './constants.js';

/** Space-pad (or truncate) an ASCII-transliterated value to an exact width. */
function padField(value: string, width: number): string {
  return transliterateDe(value).slice(0, width).padEnd(width, ' ');
}

/** Zero-pad a numeric value to an exact width (left). */
function padZero(value: string, width: number): string {
  return value.slice(-width).padStart(width, '0');
}

function fixedDate(iso: string | null, width: number): string {
  const compact = compactDate(iso);
  return compact ? compact.padStart(width, '0') : ''.padEnd(width, ' ');
}

/** Stable 5-digit Personalnummer derived from workerId (export-order independent). */
function stablePersonalnummer(workerId: string): string {
  let hash = 2166136261;
  for (let i = 0; i < workerId.length; i++) {
    hash ^= workerId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return padZero(String(((hash >>> 0) % 99999) + 1), 5);
}

/** Assign collision-free Personalnummer values across the export batch. */
function assignPersonalnummers(employees: PayrollFeedEmployee[]): Map<string, string> {
  const used = new Set<string>();
  const byWorker = new Map<string, string>();

  for (const employee of employees) {
    const base = stablePersonalnummer(employee.workerId);
    let candidate = base;
    let offset = 0;
    while (used.has(candidate)) {
      offset += 1;
      if (offset >= 99999) {
        throw new Error(`DATEV Personalnummer space exhausted for worker ${employee.workerId}`);
      }
      const numeric = ((parseInt(base, 10) - 1 + offset) % 99999) + 1;
      candidate = padZero(String(numeric), 5);
    }
    used.add(candidate);
    byWorker.set(employee.workerId, candidate);
  }

  return byWorker;
}

function datevKirchensteuerCode(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '  ';
  if (typeof raw === 'boolean') {
    // Legacy boolean carries no confession — never guess a code; export blank until migrated.
    if (raw)
      log.warn('kirchensteuer legacy boolean=true exported blank; migrate to confession code');
    return '  ';
  }
  if (typeof raw === 'string') return padField(raw, 2);
  return '  ';
}

function datevRecord(e: PayrollFeedEmployee, personalnummer: string): string {
  const { firstNames, surname } = splitName(e.displayName);
  const kinderfreibetrag = cf(e, 'kinderfreibetrag');
  const values: Record<string, string> = {
    personalnummer: personalnummer,
    nachname: padField(surname, 30),
    vorname: padField(firstNames, 30),
    steuerklasse: padField(cf(e, 'lohnsteuerklasse'), 1),
    kirchensteuer: datevKirchensteuerCode(e.countryFields.kirchensteuer),
    steuerIdNr: padField(cf(e, 'steuerIdNr'), 11),
    svNummer: padField(cf(e, 'svNummer'), 12),
    krankenkasse: padField(cf(e, 'krankenkasse'), 10),
    kinderfreibetrag: padField(kinderfreibetrag ? Number(kinderfreibetrag).toFixed(2) : '', 4),
    eintrittsdatum: fixedDate(e.hireDate, 8),
    austrittsdatum: fixedDate(e.terminatedAt, 8),
  };
  const record = DATEV_FIELDS.map(f => values[f.key]).join('');
  if (record.length !== DATEV_RECORD_LENGTH) {
    throw new Error(
      `DATEV record length mismatch: expected ${DATEV_RECORD_LENGTH}, got ${record.length}`,
    );
  }
  return record;
}

export function generateDatevAscii(feed: PayrollFeed): Buffer {
  const personalnummers = assignPersonalnummers(feed.employees);
  const header = [
    DATEV_FORMAT_MARKER,
    DATEV_FORMAT_VERSION,
    DATEV_PRODUCT,
    DATEV_MODULE,
    compactDate(feed.generatedAt),
    String(feed.employees.length),
  ].join(';');
  const records = feed.employees.map(e =>
    datevRecord(e, personalnummers.get(e.workerId) ?? stablePersonalnummer(e.workerId)),
  );
  return Buffer.from(`${[header, ...records].join('\n')}\n`, 'latin1');
}
