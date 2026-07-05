// Symfonia Kadry i Płace import contract.
//
// Column order is pinned to the Symfonia employee-import layout and locked by a
// golden fixture. Statutory/vendor correctness is an adviser-verify checkpoint
// (Symfonia import spec + doradca podatkowy review) — legal sign-off deferred,
// local-only posture; the structural contract is what ships.

export const SYMFONIA_PROFILE_ID = 'symfonia';
export const SYMFONIA_FLAG_KEY = 'payroll.symfonia';

/** CSV header order == XML element order. */
export const SYMFONIA_COLUMNS = [
  'Nazwisko',
  'Imie',
  'PESEL',
  'Stanowisko',
  'DataZatrudnienia',
  'DataZwolnienia',
  'Etat',
  'UrzadSkarbowy',
  'KodTytuluZUS',
  'OddzialNFZ',
  'StawkaBrutto',
] as const;

export const SYMFONIA_XML_ROOT = 'Pracownicy';
export const SYMFONIA_XML_RECORD = 'Pracownik';
