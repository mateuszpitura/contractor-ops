// IRS TIN-Matching client seam.
//
// The IRS TIN Matching Program (Pub 2108A) answers a name/TIN pair with a
// numerical response indicator: 0 = the name/TIN combination matches IRS
// records, any non-zero value = a mismatch or an unusable request. The same
// indicator contract is shared by both the interactive (<=25/request) and bulk
// (<=100k/file) live modes, so a single interface models both.
//
// A deterministic MockTinMatchClient is the shipped default; the live
// EServicesTinMatchClient sits behind this seam, dark, until PAF (Payer Account
// File) enrollment + e-Services registration clears. Callers depend only on
// this interface.

/** The kind of taxpayer identifier being matched. */
export type TinType = 'EIN' | 'SSN';

/** A single name/TIN match request. */
export interface TinMatchInput {
  /** The recipient legal name as it should appear on IRS records. */
  name: string;
  /** The taxpayer identification number, digits only or hyphenated. */
  tin: string;
  /** Whether the TIN is an EIN or an SSN. */
  tinType: TinType;
}

/** The outcome of a single match request. */
export interface TinMatchResult {
  /**
   * The IRS numerical response indicator. 0 = matched; any non-zero value
   * indicates a mismatch or an unusable request (e.g. invalid TIN format).
   */
  responseIndicator: number;
  /** Convenience derivation: true iff `responseIndicator === 0`. */
  matched: boolean;
}

/**
 * Abstracts the IRS TIN-Matching call. Implementations return the IRS numerical
 * response indicator; the cache, retry, and mismatch-handling policy live in the
 * consuming service, not here.
 */
export interface TinMatchClient {
  match(input: TinMatchInput): Promise<TinMatchResult>;
}
