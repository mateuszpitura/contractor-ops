/**
 * Subscription model + event catalog contract. The event-catalog + envelope
 * portion lives in `packages/validators/src/webhooks`; the CRUD-router portion
 * in `routers/core/webhook-subscription`.
 *
 * The catalog is a Zod discriminated union over 16 event types; the envelope
 * wraps `{ id, type, created_at, organization_id, data, include_pii }`. The
 * staff router mirrors `apiKeyRouter`: create (SSRF-checked), list, update,
 * rotateSecret, delete, testFire, listDeliveries — tier-capped + audited.
 */

import { describe, expect, it } from 'vitest';

const VALIDATORS_MODULE = '@contractor-ops/validators';
const ROUTER_MODULE = '../routers/core/webhook-subscription';

const EXPECTED_EVENTS = [
  'contractor.created',
  'contractor.updated',
  'contractor.offboarded',
  'contractor.compliance_blocked',
  'invoice.received',
  'invoice.matched',
  'invoice.approved',
  'invoice.rejected',
  'invoice.paid',
  'payment_run.created',
  'payment_run.completed',
  'workflow.task.completed',
  'workflow.completed',
  'classification.outcome',
  'compliance_doc.expiring_soon',
  'compliance_doc.expired',
] as const;

describe('webhook event catalog (INTEG-WEBHOOK-02)', () => {
  it('enumerates exactly the 16 locked event types', async () => {
    const mod = (await import(VALIDATORS_MODULE)) as Record<string, unknown>;
    const types = mod.WEBHOOK_EVENT_TYPES as readonly string[] | undefined;
    expect(types).toBeDefined();
    expect([...(types ?? [])].sort()).toEqual([...EXPECTED_EVENTS].sort());
  });

  it('accepts a well-formed envelope and rejects an unknown event type', async () => {
    const mod = (await import(VALIDATORS_MODULE)) as Record<string, unknown>;
    const schema = mod.webhookEventEnvelopeSchema as
      | { safeParse: (v: unknown) => { success: boolean } }
      | undefined;
    expect(schema).toBeDefined();

    const good = {
      id: 'evt_1',
      type: 'invoice.paid',
      created_at: '2026-07-05T00:00:00.000Z',
      organization_id: 'org_1',
      data: { invoiceId: 'inv_1' },
      include_pii: false,
    };
    expect(schema?.safeParse(good).success).toBe(true);
    expect(schema?.safeParse({ ...good, type: 'invoice.exploded' }).success).toBe(false);
  });
});

describe('webhookSubscriptionRouter surface (INTEG-WEBHOOK-01) — RED until 100-08', () => {
  it('exposes the staff CRUD + rotateSecret + testFire + listDeliveries procedures', async () => {
    const mod = (await import(ROUTER_MODULE)) as Record<string, unknown>;
    const router = mod.webhookSubscriptionRouter as {
      _def?: { procedures?: Record<string, unknown> };
    };
    expect(router).toBeDefined();
    const procedures = Object.keys(router._def?.procedures ?? {});
    for (const proc of [
      'create',
      'list',
      'update',
      'rotateSecret',
      'delete',
      'testFire',
      'listDeliveries',
    ]) {
      expect(procedures).toContain(proc);
    }
  });
});
