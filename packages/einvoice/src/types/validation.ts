// ---------------------------------------------------------------------------
// Validation Types
// ---------------------------------------------------------------------------

/**
 * Individual validation error or warning.
 */
export interface ValidationError {
  code: string;
  message: string;
  /** XPath or field path where the error occurred */
  path?: string;
  severity: "error" | "warning";
}

/**
 * Result of validating an e-invoice XML document against a profile's rules.
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  profileId: string;
}
