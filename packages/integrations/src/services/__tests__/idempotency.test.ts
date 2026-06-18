import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { deriveIdempotencyKey, GLOBAL_ORG_SENTINEL } from '../idempotency.js';

describe('deriveIdempotencyKey', () => {
  it('is deterministic for identical inputs', () => {
    const a = deriveIdempotencyKey({
      orgId: 'org_123',
      operation: 'docusign.envelope.create',
      businessKey: 'contract_abc',
    });
    const b = deriveIdempotencyKey({
      orgId: 'org_123',
      operation: 'docusign.envelope.create',
      businessKey: 'contract_abc',
    });

    expect(a).toBe(b);
  });

  it('produces a 64-character lowercase hex string', () => {
    const key = deriveIdempotencyKey({
      orgId: 'org_123',
      operation: 'storecove.peppol.send',
      businessKey: 'invoice_xyz',
    });

    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('partitions by orgId so two tenants never collide on the same business key', () => {
    const left = deriveIdempotencyKey({
      orgId: 'org_left',
      operation: 'auth.email.magic-link',
      businessKey: 'user@example.com',
    });
    const right = deriveIdempotencyKey({
      orgId: 'org_right',
      operation: 'auth.email.magic-link',
      businessKey: 'user@example.com',
    });

    expect(left).not.toBe(right);
  });

  it('partitions by operation so two verbs on the same entity never collide', () => {
    const create = deriveIdempotencyKey({
      orgId: 'org_123',
      operation: 'google-calendar.event.create',
      businessKey: 'entity_abc',
    });
    const update = deriveIdempotencyKey({
      orgId: 'org_123',
      operation: 'google-calendar.event.update',
      businessKey: 'entity_abc',
    });

    expect(create).not.toBe(update);
  });

  it('partitions by businessKey so two distinct entities never collide', () => {
    const a = deriveIdempotencyKey({
      orgId: 'org_123',
      operation: 'docusign.envelope.create',
      businessKey: 'contract_a',
    });
    const b = deriveIdempotencyKey({
      orgId: 'org_123',
      operation: 'docusign.envelope.create',
      businessKey: 'contract_b',
    });

    expect(a).not.toBe(b);
  });

  it('accepts the GLOBAL_ORG_SENTINEL for orgless flows (e.g. pre-tenancy auth)', () => {
    const key = deriveIdempotencyKey({
      orgId: GLOBAL_ORG_SENTINEL,
      operation: 'auth.email.magic-link',
      businessKey: 'user@example.com|magic-link|abc',
    });

    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  // Regression guard — pin the exact wire format. If a future refactor
  // changes the composition (separator, ordering, encoding) this test will
  // catch it before it silently invalidates every in-flight idempotency
  // window across providers.
  // biome-ignore lint/suspicious/noTemplateCurlyInString: literal placeholder — test name documents the sha256 composition format, not an interpolation
  it('matches the canonical sha256(`${orgId}:${operation}:${businessKey}`) format', () => {
    const orgId = 'org_fixed';
    const operation = 'docusign.envelope.create';
    const businessKey = 'contract_fixed';

    const expected = createHash('sha256')
      .update(`${orgId}:${operation}:${businessKey}`)
      .digest('hex');

    expect(deriveIdempotencyKey({ orgId, operation, businessKey })).toBe(expected);
    // Pinned literal — fails loud if anyone tweaks the algorithm.
    expect(deriveIdempotencyKey({ orgId, operation, businessKey })).toBe(
      '0a12d3127c0aabe64dd90979d5fa1e61d80a39f2248496d14972dde0a0d56a7e',
    );
  });
});
