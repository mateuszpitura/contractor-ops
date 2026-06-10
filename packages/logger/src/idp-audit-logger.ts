// IdP deprovisioning audit logger.
//
// Returns a Pino child logger that:
//   - Inherits auth/secret redaction from PII_MASK_PATHS (passwords, tokens,
//     apiKeys, contractor PII)
//   - EXPLICITLY omits the body and `*.body` paths from the default redact
//     config — audit lines emit structured fields (scopeDelta, body), and
//     these MUST survive in plaintext for compliance fidelity.
//
// PII note: `externalUserId` is the contractor's IdP email address. It MUST
// NOT appear in plaintext audit log lines (GDPR / SOC2). Callers MUST pass
// a SHA-256 hash via `hashExternalUserId(rawEmail)` rather than the raw value.
// The `externalUserId` allow-list field carries the hash, not the email.
//
// Example call:
//
//   getIdpAuditLogger().info(
//     {
//       auditEvent: 'deprovision',
//       externalUserId: hashExternalUserId('alice@example.com'),
//       actionResult: 'OK',
//       provider: 'google',
//       connectionId: 'c_x',
//       scopeDelta: { revoked: ['user.deprovision'] },
//     },
//     'IdP deprovision applied',
//   );

import { createHash } from 'node:crypto';
import type { Logger } from 'pino';

import { logger as rootLogger } from './index.js';
import { PII_MASK_PATHS } from './pii-mask.js';

/**
 * Hash a contractor's IdP identifier (email) for audit-log emission.
 * Using SHA-256 keeps the value opaque while still allowing auditors to
 * correlate entries for the same subject across a single incident review
 * (consistent hash for the same input within a deployment).
 */
export function hashExternalUserId(rawId: string): string {
  return createHash('sha256').update(rawId).digest('hex');
}

/**
 * Canonical schema of fields permitted on IdP audit log lines.
 *
 * Adding to this list is a deliberate audit-schema change — coordinate with
 * the compliance team before merging. CI does not currently enforce closure
 * (the IdpAuditEvent type below is a partial map) but the documented
 * contract is "extras-discouraged".
 *
 * Initial 9 fields cover per-action audit (auditEvent, externalUserId, etc.).
 * Saga + provenance fields (runId, stepId, hashes, attempts, etc.) are all
 * SHA-256 hashes, enum discriminators, or opaque IDs — no PII.
 * Error-class + manual-override discriminators: `errorClass` and
 * `manualOverrideCategory` are closed enums; `manualOverriddenByUserId` is an
 * opaque id — no PII. The free-text override-rationale column is DELIBERATELY
 * excluded from this allow-list — it lives only in the DB and is never logged raw.
 */
export const IDP_AUDIT_ALLOWED_FIELDS = [
  // Per-action audit fields — DO NOT REMOVE
  'auditEvent',
  'externalUserId',
  'actionResult',
  'provider',
  'connectionId',
  'scopeDelta',
  'organizationId',
  'userId',
  'timestamp',
  // Saga + provenance audit fields
  'runId',
  'stepId',
  'stepKind',
  'requestSha256',
  'responseSha256',
  'attempts',
  'failureKind',
  'matchedProvenanceId',
  // Error-class + manual-override discriminators (non-PII)
  'errorClass',
  'manualOverrideCategory',
  'manualOverriddenByUserId',
] as const;

export type IdpAuditAllowedField = (typeof IDP_AUDIT_ALLOWED_FIELDS)[number];

/**
 * Strongly-typed audit event payload. `auditEvent` is mandatory; remaining
 * fields are optional but should be drawn from the allow-list.
 */
export type IdpAuditEvent = {
  [K in IdpAuditAllowedField]?: unknown;
} & {
  auditEvent: string;
};

/**
 * Internal helper — returns an audit child of the given parent. Exposed so
 * tests can mount a parent logger with an in-memory destination and verify
 * the redact contract without touching the global root's multistream.
 */
export function createIdpAuditChild(parent: Logger): Logger {
  const auditPaths = PII_MASK_PATHS.filter(p => p !== '*.body' && p !== 'body');
  return parent.child(
    { service: 'idp-audit' },
    { redact: { paths: auditPaths as string[], censor: '[REDACTED]' } },
  );
}

/**
 * Returns the IdP audit child logger.
 *
 * The child inherits the root logger's PII redact paths, EXCEPT `body` and
 * `*.body` which are intentionally omitted so the audit `scopeDelta`,
 * webhook body, and similar fields survive in plaintext.
 *
 * Bindings `service: 'idp-audit'` are present on every line, enabling
 * downstream routing (e.g., separate Axiom dataset — deferred per CONTEXT.md).
 */
export function getIdpAuditLogger(): Logger {
  return createIdpAuditChild(rootLogger);
}
