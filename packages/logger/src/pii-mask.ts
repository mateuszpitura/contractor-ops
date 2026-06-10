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
] as const;

export type PiiMaskKeyword = (typeof PII_MASK_KEYWORDS)[number];
