import type { Lohnsteuerklasse } from '@contractor-ops/validators';

// ---------------------------------------------------------------------------
// ELStAM (Elektronische LohnSteuerAbzugsMerkmale) lookup — deliberate local-only
// stub seam.
//
// The German payroll process pulls an employee's electronic wage-tax deduction
// features (tax class, church-tax flag, child allowances, factor) from the
// Finanzverwaltung's ELStAM database keyed by the Steuer-Identifikationsnummer.
// There is NO live government API wired here: the app runs local-only and the
// real ELStAM connection needs an employer certificate + registered
// transmission channel that is out of scope for this build. This module is the
// typed integration seam a later real implementation slots into — it performs
// no network call and returns a STUB result so callers can code against the
// final shape today.
// ---------------------------------------------------------------------------

export interface ElstamLookupInput {
  /** 11-digit German Steuer-Identifikationsnummer identifying the employee. */
  steuerIdNr: string;
  /** ISO date of birth, used by the real ELStAM lookup for disambiguation. */
  dateOfBirth?: string;
}

/** The wage-tax deduction features the real ELStAM response carries. */
export interface ElstamDeductionFeatures {
  lohnsteuerklasse: Lohnsteuerklasse | null;
  kirchensteuerabzug: boolean | null;
  kinderfreibetrag: number | null;
  faktor: number | null;
}

export interface ElstamStubResult {
  /** Marks this as the stub seam, never a live Finanzverwaltung response. */
  source: 'STUB';
  /** Always false — no real deduction features are resolved locally. */
  available: false;
  features: ElstamDeductionFeatures;
  /** Human-readable reason surfaced to callers/logs. */
  note: string;
}

const EMPTY_FEATURES: ElstamDeductionFeatures = {
  lohnsteuerklasse: null,
  kirchensteuerabzug: null,
  kinderfreibetrag: null,
  faktor: null,
};

/**
 * Stub ELStAM lookup. Returns an unavailable STUB result without touching the
 * network. Swap the body for the real Finanzverwaltung transmission when the
 * employer certificate + channel land; the return shape stays the same.
 */
export function lookupElstam(input: ElstamLookupInput): ElstamStubResult {
  return {
    source: 'STUB',
    available: false,
    features: { ...EMPTY_FEATURES },
    note: `ELStAM lookup stubbed for Steuer-IdNr ending ${input.steuerIdNr.slice(-2)} — no live Finanzverwaltung API is wired in this deployment.`,
  };
}
