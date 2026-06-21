// packages/validators/src/reference-data/index.ts
//
// Barrel for the seeded, versioned, adviser-verify reference-lookup tables.
// These are local-only snapshots — no live government API by design.

export type { Krankenkasse } from './krankenkassen.js';
export {
  KRANKENKASSEN,
  KRANKENKASSEN_SOURCE,
  KRANKENKASSEN_VERSION,
} from './krankenkassen.js';
export type { UrzadSkarbowy } from './urzedy-skarbowe.js';
export {
  URZEDY_SKARBOWE,
  URZEDY_SKARBOWE_SOURCE,
  URZEDY_SKARBOWE_VERSION,
} from './urzedy-skarbowe.js';
export type { ZusOddzial } from './zus-oddzialy.js';
export {
  ZUS_ODDZIALY,
  ZUS_ODDZIALY_SOURCE,
  ZUS_ODDZIALY_VERSION,
} from './zus-oddzialy.js';
