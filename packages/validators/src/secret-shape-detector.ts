// Phase 75 D-11 — Structural defence preventing actual secret values from
// being pasted into CredentialReference rows. Used by:
//   - Client-side instant feedback (looksLikeSecret called on input change)
//   - Server-side Zod refinement (looksLikeSecretRefinement on vaultUrl/label/notes)
//
// Stores POINTERS only — never secrets. The detector is a structural defence,
// NOT a soft warning: matched input is rejected with TRPCError BAD_REQUEST.

import type { z } from 'zod';

/**
 * Pattern definition. The `regex` is matched against the FULL TRIMMED input
 * (not searched within). Most-specific patterns appear first to ensure stable
 * patternId attribution under multi-match conditions.
 */
export interface SecretPattern {
  id: string;
  regex: RegExp;
  /** Human-readable hint shown in form-field errors. */
  fieldHint: string;
}

/**
 * D-11 patterns — order matters. Most-specific first.
 *
 * `^...$` anchors are used to require WHOLE-input match, not substring.
 * The detector is intended for short pointer-like inputs (vault URL, label,
 * 1-line notes) — NOT for arbitrary multi-line text.
 */
export const SECRET_PATTERNS: readonly SecretPattern[] = [
  // AWS access key — 20 chars, AKIA prefix
  {
    id: 'aws-access-key',
    regex: /^AKIA[0-9A-Z]{16}$/,
    fieldHint: 'AWS access key (AKIA…)',
  },
  // GitHub PAT — fine-grained (newer, longer, higher specificity than classic).
  // Real tokens carry a long opaque suffix; require >=40 chars after the prefix
  // so it stays well clear of the 36-char classic PAT while matching real
  // fine-grained tokens (typically 60-90 chars).
  {
    id: 'github-pat-fine-grained',
    regex: /^github_pat_[A-Za-z0-9_]{40,}$/,
    fieldHint: 'GitHub fine-grained personal access token',
  },
  // GitHub PAT — classic
  {
    id: 'github-pat-classic',
    regex: /^ghp_[A-Za-z0-9]{36}$/,
    fieldHint: 'GitHub classic personal access token',
  },
  // GitHub OAuth user-to-server token
  {
    id: 'github-oauth',
    regex: /^gho_[A-Za-z0-9]{36}$/,
    fieldHint: 'GitHub OAuth token',
  },
  // GitHub server-to-server token
  {
    id: 'github-server-token',
    regex: /^ghs_[A-Za-z0-9]{36}$/,
    fieldHint: 'GitHub server token',
  },
  // Stripe API key (live or test)
  {
    id: 'stripe-key',
    regex: /^sk_(live|test)_[A-Za-z0-9]{24,}$/,
    fieldHint: 'Stripe API key',
  },
  // Google API key
  {
    id: 'google-api-key',
    regex: /^AIza[0-9A-Za-z_-]{35}$/,
    fieldHint: 'Google API key',
  },
  // Slack bot/app/user/refresh token
  {
    id: 'slack-bot-token',
    regex: /^xox[baprs]-[A-Za-z0-9-]+$/,
    fieldHint: 'Slack token',
  },
  // JWT (3 base64url-encoded segments separated by dots)
  {
    id: 'jwt',
    regex: /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
    fieldHint: 'JWT-shaped token',
  },
  // PEM private-key block opener — uses substring match because PEM is multi-line
  // and the leading newline / trailing content is irrelevant to the threat
  {
    id: 'private-key-block',
    regex: /-----BEGIN (RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/,
    fieldHint: 'PEM private key',
  },
  // AWS secret access key — 40-char base64-ish (catches strings shaped like
  // canonical AWS secret keys when pasted into label / short field).
  // Requires at least one non-(lowercase-hex) char so a pure-hex 40-char
  // string falls through to the more-specific `hex-32-plus` catch-all below
  // (real AWS secret keys are random base64 and always carry such a char).
  {
    id: 'aws-secret-access-key',
    regex: /^(?=.*[G-Zg-z/+=])[A-Za-z0-9/+=]{40}$/,
    fieldHint: 'AWS secret access key (40-char base64)',
  },
  // Hex 32+ chars — catch-all for generic API tokens, MD5/SHA hashes shaped
  // as secrets. LAST in the order so more-specific patterns win.
  {
    id: 'hex-32-plus',
    regex: /^[0-9a-f]{32,}$/i,
    fieldHint: 'Hex-encoded token (≥32 chars)',
  },
] as const;

export interface LooksLikeSecretResult {
  matched: boolean;
  patternId?: string;
  fieldHint?: string;
}

/**
 * Returns true if the trimmed input matches any of the SECRET_PATTERNS.
 * The first matching pattern's `id` and `fieldHint` are returned.
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
    if (pattern.regex.test(trimmed)) {
      return { matched: true, patternId: pattern.id, fieldHint: pattern.fieldHint };
    }
  }
  return { matched: false };
}

/**
 * Zod refinement for fields that should NEVER contain raw secrets
 * (vaultUrl, label, notes). Used by Plan 75-07's tRPC schemas.
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
