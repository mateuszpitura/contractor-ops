// packages/validators/src/legal/index.ts
//
// COMPL doc-name locked-phrase registry aggregator.
// Re-exports the per-jurisdiction locked-name modules so consumers can import a
// single surface. Per-jurisdiction legal review still lands per-file (UK adviser
// reviews compliance-uk.ts, Steuerberater reviews compliance-de.ts, etc.).

export {
  LOCKED_COMPL_NAMES_DE,
  type LockedComplNameKeyDE,
  RESERVED_COMPL_KEYS_DE,
} from './compliance-de.js';
export {
  LOCKED_COMPL_NAMES_KSA,
  type LockedComplNameKeyKSA,
  RESERVED_COMPL_KEYS_KSA,
} from './compliance-ksa.js';
export {
  LOCKED_COMPL_NAMES_PL,
  type LockedComplNameKeyPL,
  RESERVED_COMPL_KEYS_PL,
} from './compliance-pl.js';
export {
  LOCKED_COMPL_NAMES_UAE,
  type LockedComplNameKeyUAE,
  RESERVED_COMPL_KEYS_UAE,
} from './compliance-uae.js';
export {
  LOCKED_COMPL_NAMES_UK,
  type LockedComplNameKeyUK,
  RESERVED_COMPL_KEYS_UK,
} from './compliance-uk.js';
export {
  LOCKED_COMPL_NAMES_US,
  type LockedComplNameKeyUS,
  RESERVED_COMPL_KEYS_US,
} from './compliance-us.js';
