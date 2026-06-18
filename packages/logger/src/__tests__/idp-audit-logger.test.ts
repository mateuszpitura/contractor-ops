// IdP audit logger contract tests.
//
// We mount a fresh pino into an in-memory Writable sink (same approach as
// default-body-redact.test.ts and with-body-logging.test.ts) and exercise
// the audit-child contract via `createIdpAuditChild(parent)`. The
// production `getIdpAuditLogger()` delegates to that helper with the
// global root, so the contract is identical.

import { createHash } from 'node:crypto';
import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import type { IdpAuditEvent } from '../idp-audit-logger.js';
import {
  createIdpAuditChild,
  hashExternalUserId,
  IDP_AUDIT_ALLOWED_FIELDS,
} from '../idp-audit-logger.js';
import { PII_MASK_PATHS } from '../pii-mask.js';

function setup() {
  const chunks: string[] = [];
  const sink = new Writable({
    write(chunk, _encoding, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  // Mount a parent with the SAME redact config as the production root so
  // the audit child's redact override is exercised against an identical
  // baseline.
  const parent = pino(
    {
      level: 'debug',
      redact: { paths: [...PII_MASK_PATHS], censor: '[REDACTED]' },
    },
    sink,
  );
  const audit = createIdpAuditChild(parent);
  return { chunks, audit };
}

describe('getIdpAuditLogger (FOUND6-06 — D-15)', () => {
  it('emits externalUserId as a SHA-256 hash — raw email must not appear in logs', () => {
    const { chunks, audit } = setup();
    const rawEmail = 'alice@example.com';
    const hashed = hashExternalUserId(rawEmail);
    audit.info(
      {
        auditEvent: 'deprovision',
        externalUserId: hashed,
      } satisfies IdpAuditEvent,
      'audit',
    );
    const joined = chunks.join('');
    // The hash must appear (audit traceability)
    expect(joined).toContain(hashed);
    // The raw email must NOT appear (PII protection)
    expect(joined).not.toContain(rawEmail);
  });

  it('hashExternalUserId produces a stable 64-char hex SHA-256', () => {
    const h = hashExternalUserId('alice@example.com');
    expect(h).toBe(createHash('sha256').update('alice@example.com').digest('hex'));
    expect(h).toHaveLength(64);
    // Same input → same output (stable for within-incident correlation)
    expect(hashExternalUserId('alice@example.com')).toBe(h);
    // Different input → different output
    expect(hashExternalUserId('bob@example.com')).not.toBe(h);
  });

  it('emits scopeDelta in plaintext (audit field allow-list)', () => {
    const { chunks, audit } = setup();
    audit.info(
      {
        auditEvent: 'reconnect',
        scopeDelta: { added: ['user.deprovision'], removed: [] },
      } satisfies IdpAuditEvent,
      'scope upgrade',
    );
    const joined = chunks.join('');
    expect(joined).toContain('user.deprovision');
  });

  it('redacts password / token / apiKey even though emitted by audit logger', () => {
    const { chunks, audit } = setup();
    // Cast to bypass IdpAuditEvent type-narrowing — we test the redact paths.
    // PII_MASK_PATHS uses `*.password` etc. (depth-2 wildcard), so wrap
    // creds in a `creds` object to exercise the path correctly.
    audit.info(
      {
        auditEvent: 'rotate',
        creds: {
          password: 'should-redact',
          token: 'tok-xyz',
          apiKey: 'ak-123',
        },
      } as any,
      'rotate creds',
    );
    const joined = chunks.join('');
    expect(joined).not.toContain('should-redact');
    expect(joined).not.toContain('tok-xyz');
    expect(joined).not.toContain('ak-123');
    expect(joined).toContain('[REDACTED]');
  });

  it('does NOT redact body field (audit logger override of Plan 70-03 default-redact)', () => {
    const { chunks, audit } = setup();
    audit.info(
      {
        auditEvent: 'webhook-received',
        body: { event_type: 'user.suspended' },
      } as any,
      'webhook',
    );
    const joined = chunks.join('');
    expect(joined).toContain('user.suspended');
  });

  it('binds service: idp-audit on every line', () => {
    const { chunks, audit } = setup();
    audit.info({ auditEvent: 'noop' } satisfies IdpAuditEvent, 'noop');
    const joined = chunks.join('');
    expect(joined).toContain('"service":"idp-audit"');
  });

  it('IDP_AUDIT_ALLOWED_FIELDS contains the canonical fields (Phase 70 + 76 + 77)', () => {
    expect([...IDP_AUDIT_ALLOWED_FIELDS]).toEqual([
      // Per-action audit fields
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
    ]);
  });
});
