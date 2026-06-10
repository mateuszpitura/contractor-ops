// PII mask utility for tax IDs.
//
// Mirrors the pii-mask precedent (packages/logger/src/pii-mask.ts).
// The orchestrator in `tax-id-validation.service.ts` calls `maskTaxId()` on
// every log statement that would otherwise touch a raw VAT number.
//
// Rule:
//   - null / undefined / ''         → '[empty]'
//   - length <= 4                   → full-star redaction
//   - otherwise                     → <first-2> + <middle-stars> + <last-4>
//
// Rationale: the country-code prefix (2 chars) is low-risk + useful for
// triage; the last 4 chars give operators just enough entropy to correlate
// log lines without enabling identification. Middle masking enforces a
// minimum of one star so values of length 5–6 still redact.
//
// The tax-id-validation.service.ts orchestrator MUST wrap every logger call
// that references the VAT value with this helper (ASVS V7 / V8).
// Pino's object-level redact (packages/logger/src/pii-mask.ts) complements
// this for structured-body paths; this helper covers freeform string fields.

export function maskTaxId(value: string | null | undefined): string {
  if (!value) return '[empty]';
  const trimmed = value.trim();
  if (trimmed.length === 0) return '[empty]';
  if (trimmed.length <= 4) return '*'.repeat(trimmed.length);
  const prefix = trimmed.slice(0, 2); // country-code pair
  const suffix = trimmed.slice(-4);
  const midLen = Math.max(1, trimmed.length - 6);
  return `${prefix}${'*'.repeat(midLen)}${suffix}`;
}
