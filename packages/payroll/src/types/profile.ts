// ---------------------------------------------------------------------------
// Payroll Export Profile Interface
// ---------------------------------------------------------------------------
//
// Each per-market payroll target (Symfonia, DATEV, RTI FPS, Gusto, …)
// implements this interface and self-registers in the payroll registry. The
// engine orchestrates profiles by id; profiles provide the target-specific
// file/format logic. New targets are added by implementing this interface —
// the engine core never contains country code (clone of the e-invoice engine).

import type { PayrollFeed } from './feed.js';

/** File kind a profile emits. */
export type PayrollExportExt = 'csv' | 'xml' | 'txt';

/**
 * The output of a single payroll export generation.
 *
 * `warnings` collects non-fatal advisories (transliteration of diacritics,
 * a non-throwing XSD-validate result when the offline bundle is absent, a
 * native adapter falling back to CSV, …) for surfacing in the UI.
 */
export interface PayrollExportResult {
  buffer: Buffer;
  ext: PayrollExportExt;
  mime: string;
  warnings?: string[];
}

/**
 * A per-market payroll export target.
 *
 * `opts` is intentionally `unknown` at the shared-interface level: a profile
 * narrows it to its own options type at the implementation signature (e.g.
 * Symfonia's `{ format: 'csv' | 'xml' }`). Callers working through the
 * `PayrollExportProfile` reference type-assert before passing options; direct
 * callers get full type-safety from the narrowed signature.
 */
export interface PayrollExportProfile {
  /** Unique profile identifier (e.g. "symfonia", "datev", "rti-fps", "gusto") */
  readonly profileId: string;
  /** ISO 3166-1 alpha-2 country code (PL | DE | GB | US) */
  readonly country: string;
  /** Human-readable name (e.g. "Symfonia Kadry i Płace (PL)") */
  readonly displayName: string;
  /** The ship-dark feature flag key gating this target (e.g. "payroll.symfonia") */
  readonly flagKey: string;

  /** Generate the target-specific export file from a PII-masked PayrollFeed. */
  generate(feed: PayrollFeed, opts?: unknown): Promise<PayrollExportResult>;
}
