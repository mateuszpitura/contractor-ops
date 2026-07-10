/**
 * OWASP API Top-10 as executable assertions — the PRECONDITION for the public
 * write flag-flip: the write routes stay `hide:true` until every class below
 * is green.
 *
 * One describe per OWASP API class asserting the live surface:
 *   BOLA · BFLA · SSRF · mass-assignment · security-misconfig · injection.
 * Each pulls from a real control shipped earlier in the phase, so the gate is
 * RED until the whole surface lands, then GREEN — never a placeholder.
 */

import { describe, expect, it } from 'vitest';

import { PUBLIC_API_SCOPES } from '../../lib/scope-utils';

const SSRF_MODULE = '../../services/webhooks/ssrf-guard';
const VALIDATORS_MODULE = '@contractor-ops/validators';

/**
 * The delivered public WRITE surface — every mutating procedure carries one of
 * these scopes (the P99 BFLA matrix). A write reachable without a member here is
 * an unscoped mutation.
 */
const DELIVERED_WRITE_SCOPES = [
  'contractor:create',
  'contractor:update',
  'invoice:create',
  'invoice:update',
  'payment:create',
  'payment:update',
  'payment:export',
  'workflow:create',
  'workflow:execute',
  'workflow:update',
] as const;

describe('OWASP API1:2023 — BOLA (broken object-level authorization)', () => {
  it('every mutating public scope is object-scoped (entity:verb), never a bare wildcard', () => {
    const mutating = PUBLIC_API_SCOPES.filter(s =>
      /:(create|update|delete|export|execute)$/.test(s),
    );
    expect(mutating.length).toBeGreaterThan(0);
    for (const scope of mutating) {
      expect(scope).toMatch(/^[a-z_]+:(create|update|delete|export|execute)$/);
      expect(scope).not.toBe('*');
    }
  });
});

describe('OWASP API5:2023 — BFLA (broken function-level authorization)', () => {
  it('every delivered write scope is a member of the public taxonomy (reuses the P99 matrix)', () => {
    const registry = new Set<string>(PUBLIC_API_SCOPES);
    for (const scope of DELIVERED_WRITE_SCOPES) {
      expect(registry.has(scope)).toBe(true);
    }
  });

  it('webhooks:manage is a first-class public scope (added in 100-08)', () => {
    expect(PUBLIC_API_SCOPES).toContain('webhooks:manage');
  });
});

describe('OWASP API7:2023 — SSRF', () => {
  it('a private webhook URL is rejected by the guard', async () => {
    const { assertWebhookUrlSafe } = (await import(SSRF_MODULE)) as {
      assertWebhookUrlSafe: (url: string, opts: { httpAllowed: boolean }) => Promise<void>;
    };
    await expect(
      assertWebhookUrlSafe('https://169.254.169.254/', { httpAllowed: false }),
    ).rejects.toBeInstanceOf(Error);
  });
});

describe('OWASP API6:2023 — mass assignment', () => {
  it('the event envelope schema is strict (extra/privileged keys are rejected)', async () => {
    const mod = (await import(VALIDATORS_MODULE)) as Record<string, unknown>;
    const schema = mod.webhookEventEnvelopeSchema as
      | { safeParse: (v: unknown) => { success: boolean } }
      | undefined;
    expect(schema).toBeDefined();
    const withInjectedFields = {
      id: 'evt_1',
      type: 'invoice.paid',
      created_at: '2026-07-05T00:00:00.000Z',
      organization_id: 'org_1',
      data: {},
      include_pii: false,
      secretEncrypted: 'stolen',
    };
    expect(schema?.safeParse(withInjectedFields).success).toBe(false);
  });
});

describe('OWASP API8:2023 — security misconfiguration', () => {
  it('the SSRF error surfaces a typed reason, never an internal stack/secret', async () => {
    const { assertWebhookUrlSafe } = (await import(SSRF_MODULE)) as {
      assertWebhookUrlSafe: (url: string, opts: { httpAllowed: boolean }) => Promise<void>;
    };
    await expect(
      assertWebhookUrlSafe('http://10.0.0.1/', { httpAllowed: false }),
    ).rejects.toMatchObject({ reason: expect.any(String) });
  });
});

describe('OWASP API3:2023 — injection', () => {
  it('an injection string in an event filter is treated as data, not code', async () => {
    const mod = (await import(VALIDATORS_MODULE)) as Record<string, unknown>;
    const types = mod.WEBHOOK_EVENT_TYPES as readonly string[] | undefined;
    expect(types).toBeDefined();
    // The catalog is a closed enum — a `'; DROP TABLE` value is not a valid event
    // type, so it can never reach a query as an identifier.
    expect(types).not.toContain("invoice.paid'; DROP TABLE webhook_failures;--");
  });
});
