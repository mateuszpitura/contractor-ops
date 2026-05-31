import { looksLikeSecretRefinement } from '@contractor-ops/validators';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// The credentialReference router gates vaultUrl/label/notes server-side with
// looksLikeSecretRefinement (D-11). These tests exercise the exact Zod schema
// shape the router applies; full tRPC-harness integration (permission gates,
// audit emission, tenant scoping) is covered by the it.todo forward-references.
const SAFE_TEXT = z.string().min(1).max(2000).superRefine(looksLikeSecretRefinement);
const SAFE_VAULT_URL = z.string().url().superRefine(looksLikeSecretRefinement);

describe('credentialReference router — secret-shape rejection (Phase 75 D-11)', () => {
  it('rejects an AWS access key in a label field', () => {
    expect(SAFE_TEXT.safeParse('AKIAIOSFODNN7EXAMPLE').success).toBe(false);
  });

  it('rejects a GitHub classic PAT in a label field', () => {
    expect(SAFE_TEXT.safeParse('ghp_1234567890abcdefghijklmnopqrstuvwxyz').success).toBe(false);
  });

  it('rejects a JWT-shaped string', () => {
    expect(
      SAFE_TEXT.safeParse(
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      ).success,
    ).toBe(false);
  });

  it('accepts a real 1Password vault URL', () => {
    expect(SAFE_VAULT_URL.safeParse('https://my.1password.com/vaults/abc123def456').success).toBe(
      true,
    );
  });

  it('accepts a descriptive label like "Production AWS root"', () => {
    expect(SAFE_TEXT.safeParse('Production AWS root account').success).toBe(true);
  });

  it('Zod issue carries { reason, patternId } in params for client-side hint rendering', () => {
    const result = SAFE_TEXT.safeParse('AKIAIOSFODNN7EXAMPLE');
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      const params = (issue as unknown as { params?: Record<string, unknown> }).params;
      expect(params?.reason).toBe('looks_like_secret');
      expect(params?.patternId).toBe('aws-access-key');
    }
  });

  it.todo('create requires workflow:execute permission (full tRPC-harness integration)');
  it.todo('create rejects non-OFFBOARDING workflowRunId with BAD_REQUEST');
  it.todo('create emits credential_reference.created audit row in the same tx');
  it.todo('update emits credential_reference.updated with old/new values');
  it.todo(
    'markRotated sets rotatedByUserId from ctx.user.id and emits credential_reference.rotated',
  );
  it.todo('remove emits credential_reference.removed');
  it.todo('listByWorkflowRun scopes by organizationId (multi-tenant safety)');
});
