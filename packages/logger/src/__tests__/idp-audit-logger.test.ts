// Phase 70-01 · FOUND6-06 (D-15) — failing test scaffold for the dedicated
// IdP audit logger factory. Plan 70-08 implements `getIdpAuditLogger` plus
// the `IDP_AUDIT_ALLOWED_FIELDS` constant.

import { describe, expect, it, vi } from 'vitest';
// biome-ignore lint/correctness/noUnresolvedImports: target of Plan 70-08
import { getIdpAuditLogger, IDP_AUDIT_ALLOWED_FIELDS } from '../index.js';

describe('getIdpAuditLogger (FOUND6-06 — D-15)', () => {
  it('emits externalUserId in plaintext while password is redacted', () => {
    const captured: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      captured.push(typeof chunk === 'string' ? chunk : String(chunk));
      return true;
    });

    const log = getIdpAuditLogger();
    log.info(
      {
        auditEvent: 'deprovision',
        externalUserId: 'usr_123',
        password: 'should-redact',
      },
      'audit',
    );
    writeSpy.mockRestore();

    const joined = captured.join('');
    expect(joined).toContain('usr_123');
    expect(joined).not.toContain('should-redact');
  });

  it('IDP_AUDIT_ALLOWED_FIELDS contains the expected keys', () => {
    expect(IDP_AUDIT_ALLOWED_FIELDS).toContain('externalUserId');
    expect(IDP_AUDIT_ALLOWED_FIELDS).toContain('actionResult');
    expect(IDP_AUDIT_ALLOWED_FIELDS).toContain('scopeDelta');
    expect(IDP_AUDIT_ALLOWED_FIELDS).toContain('auditEvent');
  });
});
