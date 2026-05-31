// Phase 75 — aggregate IP-clause registry. The verdict engine (Plan 75-06)
// imports ALL_IP_CLAUSES to run regex grounding across all jurisdictions on
// a single contract.

import { IP_CLAUSES_DE } from './ip-clauses-de.js';
import { IP_CLAUSES_KSA } from './ip-clauses-ksa.js';
import { IP_CLAUSES_PL } from './ip-clauses-pl.js';
import { IP_CLAUSES_UAE } from './ip-clauses-uae.js';
import { IP_CLAUSES_UK } from './ip-clauses-uk.js';
import { IP_CLAUSES_US } from './ip-clauses-us.js';

export const IP_CLAUSES_BY_JURISDICTION = {
  UK: IP_CLAUSES_UK,
  DE: IP_CLAUSES_DE,
  PL: IP_CLAUSES_PL,
  US: IP_CLAUSES_US,
  KSA: IP_CLAUSES_KSA,
  UAE: IP_CLAUSES_UAE,
} as const;

export type Jurisdiction = keyof typeof IP_CLAUSES_BY_JURISDICTION;

export const ALL_IP_CLAUSES = {
  ...IP_CLAUSES_UK,
  ...IP_CLAUSES_DE,
  ...IP_CLAUSES_PL,
  ...IP_CLAUSES_US,
  ...IP_CLAUSES_KSA,
  ...IP_CLAUSES_UAE,
} as const;

export type IpClausePhraseId = keyof typeof ALL_IP_CLAUSES;

/**
 * Returns the jurisdiction prefix of a phraseId — used by the
 * cross-jurisdiction-mismatch check (D-15).
 */
export function getPhraseJurisdiction(phraseId: IpClausePhraseId): Jurisdiction {
  const prefix = phraseId.split('.')[0]?.toUpperCase();
  if (!(prefix && prefix in IP_CLAUSES_BY_JURISDICTION)) {
    throw new Error(`Unknown jurisdiction prefix in phraseId: ${phraseId}`);
  }
  return prefix as Jurisdiction;
}

export const IP_CLAUSE_PHRASE_LIBRARY_VERSION = '1.0.0' as const;

export type { DeIpClausePhraseId } from './ip-clauses-de.js';
export type { KsaIpClausePhraseId } from './ip-clauses-ksa.js';
export type { PlIpClausePhraseId } from './ip-clauses-pl.js';
export type { UaeIpClausePhraseId } from './ip-clauses-uae.js';
export type { UkIpClausePhraseId } from './ip-clauses-uk.js';
export type { UsIpClausePhraseId } from './ip-clauses-us.js';
