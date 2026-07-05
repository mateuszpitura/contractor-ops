// Employee document-expiry derivation for the HR dashboard — pure, DB-free.
//
// Composes the v6.0 F1 engine the honest way: it runs the PURE compliance-policy
// date math (`daysUntilExpiryInTz`) over employee personnel-file document rows —
// it does NOT reuse the contractor-only `compliance-reminder-scan` cron. The
// per-document TZ is resolved from the personnel file's `countryCode` via the
// compliance-policy jurisdiction resolver, so "expires today" lands at 00:00 in
// the worker's own jurisdiction, identical to the contractor expiry surface.
//
// The caller filters rows by the requester's `employeeFile{A..D}:read` grant
// BEFORE calling this, so the service is grant-agnostic and never leaks a
// section the caller cannot read.

import type { Jurisdiction, PersonnelFileSection } from '@contractor-ops/compliance-policy';
import {
  daysUntilExpiryInTz,
  mapCountryCodeToJurisdiction,
} from '@contractor-ops/compliance-policy';
import type { EmployeeDocCategory } from '@contractor-ops/db';

/** Per-jurisdiction expiry TZ, mirroring the compliance-policy rule TZs. */
const JURISDICTION_EXPIRY_TZ: Record<Jurisdiction, string> = {
  UK: 'Europe/London',
  DE: 'Europe/Berlin',
  PL: 'Europe/Warsaw',
  US: 'America/New_York',
  KSA: 'Asia/Riyadh',
  UAE: 'Asia/Dubai',
};

/** Resolve the expiry TZ for a country code; UTC when the country is unmapped. */
export function tzForCountry(countryCode: string): string {
  const jurisdiction = mapCountryCodeToJurisdiction(countryCode);
  return jurisdiction ? JURISDICTION_EXPIRY_TZ[jurisdiction] : 'UTC';
}

export type DocExpiryBand = 'expired' | 'soon30' | 'soon60' | 'soon90' | 'later';

export interface EmployeeDocExpiryInput {
  documentId: string;
  expiresAt: Date | null;
  docCategory: EmployeeDocCategory | null;
  section: PersonnelFileSection | null;
  countryCode: string;
  workerId: string;
  workerDisplayName: string;
}

export interface EmployeeDocExpiryItem {
  documentId: string;
  workerId: string;
  workerDisplayName: string;
  docCategory: EmployeeDocCategory | null;
  section: PersonnelFileSection | null;
  expiresAt: Date;
  daysUntilExpiry: number;
  band: DocExpiryBand;
}

export interface EmployeeDocExpiryResult {
  items: EmployeeDocExpiryItem[];
  byBand: Record<DocExpiryBand, number>;
  byCategory: Record<string, number>;
}

function bandFor(daysUntil: number): DocExpiryBand {
  if (daysUntil < 0) return 'expired';
  if (daysUntil <= 30) return 'soon30';
  if (daysUntil <= 60) return 'soon60';
  if (daysUntil <= 90) return 'soon90';
  return 'later';
}

/**
 * Bucket employee documents into expiry bands via the compliance-policy TZ math.
 * Rows with a null `expiresAt` (non-expiring documents) are excluded. Pure.
 */
export function deriveEmployeeDocExpiry(
  docs: readonly EmployeeDocExpiryInput[],
  now: Date,
): EmployeeDocExpiryResult {
  const byBand: Record<DocExpiryBand, number> = {
    expired: 0,
    soon30: 0,
    soon60: 0,
    soon90: 0,
    later: 0,
  };
  const byCategory: Record<string, number> = {};
  const items: EmployeeDocExpiryItem[] = [];

  for (const doc of docs) {
    if (!doc.expiresAt) continue;
    const daysUntilExpiry = daysUntilExpiryInTz(doc.expiresAt, tzForCountry(doc.countryCode), now);
    const band = bandFor(daysUntilExpiry);
    byBand[band] += 1;
    const categoryKey = doc.docCategory ?? 'OTHER';
    byCategory[categoryKey] = (byCategory[categoryKey] ?? 0) + 1;
    items.push({
      documentId: doc.documentId,
      workerId: doc.workerId,
      workerDisplayName: doc.workerDisplayName,
      docCategory: doc.docCategory,
      section: doc.section,
      expiresAt: doc.expiresAt,
      daysUntilExpiry,
      band,
    });
  }

  items.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  return { items, byBand, byCategory };
}
