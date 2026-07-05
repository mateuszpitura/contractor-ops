/**
 * PII redaction paths for pino's `redact` option.
 *
 * Sources for the path list:
 * - UK: UTR, National Insurance number, Companies House reg, VAT number
 * - Germany: USt-IdNr, Steuernummer, Handelsregister number,
 *   Sozialversicherungsnummer (Art. 9 DSGVO sensitive data — ASVS V8)
 * - Generic: passwords, tokens, auth headers, API keys
 *
 * Paths use pino's dotted-path + `*` wildcard syntax. All paths are resolved
 * case-insensitively against log object keys by pino; add a new key here
 * rather than hoping for auto-detection.
 */
export const PII_MASK_PATHS = [
  // Authentication / secrets
  '*.password',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.apiKey',
  '*.authorization',
  '*.cookie',
  'headers.authorization',
  'headers.cookie',

  // UK contractor fields
  '*.utr',
  '*.UTR',
  '*.niNumber',
  '*.nationalInsuranceNumber',
  '*.companiesHouseNumber',
  '*.vatNumber',
  '*.vatRegistrationNumber',

  // German contractor fields
  '*.steuernummer',
  '*.ustIdNr',
  '*.ustIdnr',
  '*.vatIdNumber',
  '*.handelsregisterNumber',
  '*.sozialversicherungsnummer',
  '*.svNumber',
  '*.svNr',
  '*.socialInsuranceNumber',

  // US contractor fields. SSN is the Art. 9-grade identifier;
  // EIN is a business ID but still log-masked to prevent accidental exposure.
  '*.ssn',
  '*.SSN',
  '*.ein',
  '*.EIN',

  // Employee national-person identifiers (per-market registry). Full values live
  // only in dedicated encrypted columns and surface via the audit-logged reveal
  // path — they must never reach logs. Mirrors the `*.ssn` treatment above.
  '*.pesel',
  '*.PESEL',
  '*.iqama',
  '*.emiratesId',
  '*.emiratesID',
  '*.nationalId',
  '*.nationalID',

  // Country-scoped bundles
  '*.countryFields.utr',
  '*.countryFields.UTR',
  '*.countryFields.niNumber',
  '*.countryFields.nationalInsuranceNumber',
  '*.countryFields.vatRegistrationNumber',
  '*.countryFields.companiesHouseNumber',
  '*.countryFields.steuernummer',
  '*.countryFields.ustIdNr',
  '*.countryFields.ustIdnr',
  '*.countryFields.sozialversicherungsnummer',
  '*.countryFields.svNumber',
  '*.countryFields.socialInsuranceNumber',
  '*.countryFields.handelsregister.*',
  '*.countryFields.ssn',
  '*.countryFields.SSN',
  '*.countryFields.ein',
  '*.countryFields.EIN',
  '*.countryFields.pesel',
  '*.countryFields.iqama',
  '*.countryFields.emiratesId',
  '*.countryFields.nationalId',

  // Default-redact request/response bodies. Top-level `body` and any `*.body`
  // (one level of wrapping) emit `[REDACTED]` by default. Routers wanting
  // plaintext bodies use `withBodyLogging` from this package; every approved
  // opt-in lives in `LOG_BODY_INCLUDE_PREFIXES`.
  'body',
  '*.body',
] as const;

/**
 * Keyword list used by consumer code for custom filtering
 * (e.g. object sanitizers outside the pino pipeline).
 */
export const PII_MASK_KEYWORDS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'authorization',
  'cookie',
  'utr',
  'niNumber',
  'nationalInsuranceNumber',
  'companiesHouseNumber',
  'vatNumber',
  'vatRegistrationNumber',
  'steuernummer',
  'ustIdNr',
  'vatIdNumber',
  'handelsregisterNumber',
  'sozialversicherungsnummer',
  'svNumber',
  'svNr',
  'socialInsuranceNumber',
  'ssn',
  'ein',
  'pesel',
  'iqama',
  'emiratesId',
  'nationalId',
] as const;

export type PiiMaskKeyword = (typeof PII_MASK_KEYWORDS)[number];

/**
 * Canonical PII keyword list for structured object scrubbers that run OUTSIDE
 * the pino pipeline — the Sentry `beforeSend` scrubbers in every runtime
 * (`apps/api`, `apps/public-api`, `apps/cron-worker`, and the browser SPA
 * `apps/web-vite`, each `src/lib/sentry-scrub.ts`). Matching is
 * case-insensitive substring (see {@link isPiiScrubKey}): a key is redacted
 * when its lowercased form contains any entry.
 *
 * This is the SINGLE source of truth. The four Sentry scrub copies import
 * {@link isPiiScrubKey} from here instead of hand-maintaining parallel lists,
 * so a keyword added here redacts uniformly across the Node services and the
 * browser bundle — they can no longer drift apart (the historical failure).
 * Keep it aligned with {@link PII_MASK_PATHS} (the pino redact paths) so a
 * value masked in logs is also masked in crash reports.
 *
 * Because matching is substring, short tokens are deliberately broad: e.g.
 * `ein` (US EIN) also redacts a key like `eInvoiceId`. Over-redacting a crash
 * report is the safe side of the trade — never ship an unmasked identifier.
 */
export const PII_SCRUB_KEYWORDS = [
  // Authentication / secrets
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
  // Banking / payment instruments
  'bankaccount',
  'bank_account',
  'accountnumber',
  'routingnumber',
  'sortcode',
  'iban',
  'swiftbic',
  'swift_bic',
  // Tax identifiers
  'taxid',
  'tax_id',
  'ssn',
  'ein',
  'utr',
  'vatnumber',
  'vatregistrationnumber',
  'companieshousenumber',
  'steuernummer',
  'ustidnr',
  // Social-insurance / national-person identifiers
  'ninumber',
  'national_insurance',
  'sozialversicherungsnummer',
  'svnumber',
  'svnr',
  'pesel',
  'iqama',
  'emiratesid',
  'nationalid',
  // Other sensitive personal data
  'dateofbirth',
] as const;

export type PiiScrubKeyword = (typeof PII_SCRUB_KEYWORDS)[number];

/**
 * Case-insensitive substring test the Sentry scrubbers use to decide whether an
 * object key holds PII and must be redacted. Shared across all four scrub
 * copies so their coverage cannot diverge.
 */
export function isPiiScrubKey(key: string): boolean {
  const lower = key.toLowerCase();
  for (const keyword of PII_SCRUB_KEYWORDS) {
    if (lower.includes(keyword)) {
      return true;
    }
  }
  return false;
}
