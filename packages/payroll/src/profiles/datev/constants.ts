// DATEV Lohn und Gehalt / LODAS ASCII import layout.
//
// A header line (EXTF descriptor) followed by one fixed-width detail record per
// employee. Field widths and order are pinned to the LODAS import layout and
// locked by a golden fixture with an exact record-length hard-guard — an
// off-by-one field width rejects the whole file at import. Statutory/vendor
// correctness is a deferred adviser-verify checkpoint (DATEV Lohn import spec +
// Steuerberater review); the structural contract is what ships.

export const DATEV_PROFILE_ID = 'datev';
export const DATEV_FLAG_KEY = 'payroll.datev';

export const DATEV_FORMAT_MARKER = 'EXTF';
export const DATEV_FORMAT_VERSION = '700';
export const DATEV_PRODUCT = 'LODAS';
export const DATEV_MODULE = 'LOHN';

/** Fixed-width detail-record field spec (order == wire order). */
export const DATEV_FIELDS = [
  { key: 'personalnummer', width: 5 },
  { key: 'nachname', width: 30 },
  { key: 'vorname', width: 30 },
  { key: 'steuerklasse', width: 1 },
  { key: 'kirchensteuer', width: 2 },
  { key: 'steuerIdNr', width: 11 },
  { key: 'svNummer', width: 12 },
  { key: 'krankenkasse', width: 10 },
  { key: 'kinderfreibetrag', width: 4 },
  { key: 'eintrittsdatum', width: 8 },
  { key: 'austrittsdatum', width: 8 },
] as const;

export const DATEV_RECORD_LENGTH = DATEV_FIELDS.reduce((sum, f) => sum + f.width, 0);
