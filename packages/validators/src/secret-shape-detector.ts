// Structural defence preventing actual secret values from being pasted into
// CredentialReference rows. Used by:
//   - Client-side instant feedback (looksLikeSecret called on input change)
//   - Server-side Zod refinement (looksLikeSecretRefinement on vaultUrl/label/notes)
//
// Stores POINTERS only — never secrets. The detector is a structural defence,
// NOT a soft warning: matched input is rejected with TRPCError BAD_REQUEST.

import type { z } from 'zod';

/**
 * Pattern definition.
 *
 * `anchoredRegex` matches the FULL trimmed input (whole-value check for short
 * pointer-like fields such as vaultUrl).
 *
 * `substringRegex` matches ANYWHERE in the input — used for free-text fields
 * (notes ≤10 000 chars, label ≤2 000 chars) where a secret may be embedded
 * inside longer prose (e.g. "Rotate the AKIAIOSFODNN7EXAMPLE key").
 *
 * Most-specific patterns appear first to ensure stable patternId attribution
 * under multi-match conditions.
 */
export interface SecretPattern {
  id: string;
  /** Whole-value match — used for short fields (vaultUrl). */
  anchoredRegex: RegExp;
  /** Substring match — used for free-text fields (label, notes). */
  substringRegex: RegExp;
  /** Human-readable hint shown in form-field errors. */
  fieldHint: string;
}

/** Build a pair of (anchored, substring) regexes from a single body pattern. */
function pair(body: string, flags = ''): { anchoredRegex: RegExp; substringRegex: RegExp } {
  return {
    anchoredRegex: new RegExp(`^${body}$`, flags),
    substringRegex: new RegExp(body, flags),
  };
}

/**
 * Patterns — order matters. Most-specific first.
 */
export const SECRET_PATTERNS: readonly SecretPattern[] = [
  // AWS access key — 20 chars, AKIA prefix
  {
    id: 'aws-access-key',
    ...pair('AKIA[0-9A-Z]{16}'),
    fieldHint: 'AWS access key (AKIA…)',
  },
  // GitHub PAT — fine-grained (newer, longer, higher specificity than classic).
  {
    id: 'github-pat-fine-grained',
    ...pair('github_pat_[A-Za-z0-9_]{40,}'),
    fieldHint: 'GitHub fine-grained personal access token',
  },
  // GitHub PAT — classic
  {
    id: 'github-pat-classic',
    ...pair('ghp_[A-Za-z0-9]{36}'),
    fieldHint: 'GitHub classic personal access token',
  },
  // GitHub OAuth user-to-server token
  {
    id: 'github-oauth',
    ...pair('gho_[A-Za-z0-9]{36}'),
    fieldHint: 'GitHub OAuth token',
  },
  // GitHub server-to-server token
  {
    id: 'github-server-token',
    ...pair('ghs_[A-Za-z0-9]{36}'),
    fieldHint: 'GitHub server token',
  },
  // Stripe API key (live or test)
  {
    id: 'stripe-key',
    ...pair('sk_(live|test)_[A-Za-z0-9]{24,}'),
    fieldHint: 'Stripe API key',
  },
  // Google API key
  {
    id: 'google-api-key',
    ...pair('AIza[0-9A-Za-z_-]{35}'),
    fieldHint: 'Google API key',
  },
  // Slack bot/app/user/refresh token
  {
    id: 'slack-bot-token',
    ...pair('xox[baprs]-[A-Za-z0-9-]+'),
    fieldHint: 'Slack token',
  },
  // JWT (3 base64url-encoded segments separated by dots).
  // Anchored form keeps the whole-value check; substring form guards against
  // embedded tokens in notes. Both exclude whitespace to avoid false positives
  // on normal prose with dots.
  {
    id: 'jwt',
    anchoredRegex: /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
    substringRegex: /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
    fieldHint: 'JWT-shaped token',
  },
  // PEM private-key block opener — substring match in both modes because PEM
  // is multi-line and the surrounding content is irrelevant to the threat.
  {
    id: 'private-key-block',
    anchoredRegex: /-----BEGIN (RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/,
    substringRegex: /-----BEGIN (RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/,
    fieldHint: 'PEM private key',
  },
  // AWS secret access key — 40-char base64-ish.
  // Requires at least one non-(lowercase-hex) char so a pure-hex 40-char
  // string falls through to the more-specific `hex-32-plus` catch-all below.
  {
    id: 'aws-secret-access-key',
    anchoredRegex: /^(?=.*[G-Zg-z/+=])[A-Za-z0-9/+=]{40}$/,
    substringRegex:
      /(?<![A-Za-z0-9/+=])(?=[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=]))(?=.*[G-Zg-z/+=])[A-Za-z0-9/+=]{40}/,
    fieldHint: 'AWS secret access key (40-char base64)',
  },
  // Hex 32+ chars — catch-all for generic API tokens, MD5/SHA hashes shaped
  // as secrets. LAST in the order so more-specific patterns win.
  // Substring form requires the hex NOT to be a URL path segment (no /…/ wrapping)
  // and not to be preceded/followed by word chars, so embedded vault URL IDs don't
  // false-positive.
  {
    id: 'hex-32-plus',
    anchoredRegex: /^[0-9a-f]{32,}$/i,
    substringRegex: /(?<![/\w])[0-9a-f]{32,}(?![/\w])/i,
    fieldHint: 'Hex-encoded token (≥32 chars)',
  },
] as const;

export interface LooksLikeSecretResult {
  matched: boolean;
  patternId?: string;
  fieldHint?: string;
}

/**
 * Returns true if the trimmed input matches any of the SECRET_PATTERNS
 * using the whole-value (anchored) check — intended for short pointer-like
 * fields (vaultUrl) where the entire value must be a secret shape.
 *
 * For free-text fields (label, notes) use `looksLikeSecretInFreeText`.
 */
export function looksLikeSecret(input: string): LooksLikeSecretResult {
  if (typeof input !== 'string' || input.length === 0) {
    return { matched: false };
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { matched: false };
  }
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.anchoredRegex.test(trimmed)) {
      return { matched: true, patternId: pattern.id, fieldHint: pattern.fieldHint };
    }
  }
  return { matched: false };
}

/**
 * Returns true if the input CONTAINS a secret-shaped token anywhere in its
 * text — intended for free-text fields (notes ≤10 000 chars, label ≤2 000
 * chars) where a secret may be embedded within longer prose.
 */
export function looksLikeSecretInFreeText(input: string): LooksLikeSecretResult {
  if (typeof input !== 'string' || input.length === 0) {
    return { matched: false };
  }
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.substringRegex.test(input)) {
      return { matched: true, patternId: pattern.id, fieldHint: pattern.fieldHint };
    }
  }
  return { matched: false };
}

/**
 * Zod refinement for SHORT fields (vaultUrl) that should never BE a raw
 * secret value — whole-value match. Used by the credential-reference tRPC schemas.
 *
 * Usage:
 *   z.string().superRefine(looksLikeSecretRefinement)
 *
 * On match, attaches { reason, patternId, fieldHint } to the Zod issue's params
 * for client-side rendering of "This looks like a credential value" hints.
 */
export function looksLikeSecretRefinement(value: string, ctx: z.RefinementCtx): void {
  const result = looksLikeSecret(value);
  if (result.matched) {
    ctx.addIssue({
      code: 'custom',
      message: `This looks like a credential value (${result.fieldHint ?? 'matched secret pattern'}). Provide a vault URL or pointer description only — never paste actual secrets.`,
      params: {
        reason: 'looks_like_secret',
        patternId: result.patternId,
        fieldHint: result.fieldHint,
      },
    });
  }
}

/**
 * Zod refinement for FREE-TEXT fields (label ≤2 000 chars, notes ≤10 000
 * chars) that must never CONTAIN an embedded raw secret. Uses substring
 * matching so "Rotate the AKIAIOSFODNN7EXAMPLE key in vault" is also rejected.
 *
 * Usage:
 *   z.string().superRefine(looksLikeSecretInFreeTextRefinement)
 */
export function looksLikeSecretInFreeTextRefinement(value: string, ctx: z.RefinementCtx): void {
  const result = looksLikeSecretInFreeText(value);
  if (result.matched) {
    ctx.addIssue({
      code: 'custom',
      message: `This text appears to contain a credential value (${result.fieldHint ?? 'matched secret pattern'}). Provide a vault pointer description only — never paste actual secrets.`,
      params: {
        reason: 'looks_like_secret',
        patternId: result.patternId,
        fieldHint: result.fieldHint,
      },
    });
  }
}
