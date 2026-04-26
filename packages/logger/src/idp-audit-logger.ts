// Phase 70 D-15 — IdP deprovisioning audit logger.
//
// Returns a Pino child logger that:
//   - Inherits auth/secret redaction from PII_MASK_PATHS (passwords, tokens,
//     apiKeys, contractor PII)
//   - EXPLICITLY omits the body and `*.body` paths that Plan 70-03 added at
//     the root — audit lines emit structured fields (scopeDelta, body),
//     and these MUST survive in plaintext for compliance fidelity.
//
// Consumer: Phases 76–78 (IdP deprovisioning F2). Example call:
//
//   getIdpAuditLogger().info(
//     {
//       auditEvent: 'deprovision',
//       externalUserId: 'usr_123',
//       actionResult: 'OK',
//       provider: 'google',
//       connectionId: 'c_x',
//       scopeDelta: { revoked: ['user.deprovision'] },
//     },
//     'IdP deprovision applied',
//   );

import type { Logger } from 'pino';

import { logger as rootLogger } from './index.js';
import { PII_MASK_PATHS } from './pii-mask.js';

/**
 * Canonical schema of fields permitted on IdP audit log lines.
 *
 * Adding to this list is a deliberate audit-schema change — coordinate with
 * the compliance team before merging. CI does not currently enforce closure
 * (the IdpAuditEvent type below is a partial map) but the documented
 * contract is "extras-discouraged".
 */
export const IDP_AUDIT_ALLOWED_FIELDS = [
  'auditEvent',
  'externalUserId',
  'actionResult',
  'provider',
  'connectionId',
  'scopeDelta',
  'organizationId',
  'userId',
  'timestamp',
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
