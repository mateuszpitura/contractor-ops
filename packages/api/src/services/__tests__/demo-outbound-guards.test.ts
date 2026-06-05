// Layer-2 (service-layer) demo guards. Every guarded chokepoint shares the same
// `isDemoOrg(orgId)` predicate (unit-tested in lib/__tests__/demo.test.ts); this
// file proves the early-return actually skips the real outbound at a couple of
// representative chokepoints that accept injected deps, so no module mocks are
// needed. DEMO_ORG_IDS is set before imports so getServerEnv() caches it.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.DEMO_MODE = '';
  process.env.DEMO_ORG_IDS = 'org_demo';
});

import { PeppolOrchestrator } from '../peppol-orchestrator';
import { submitToZatca } from '../zatca-submission';

function makePeppolDeps() {
  const adapter = {
    pollInboundInvoices: vi.fn(async () => []),
    transmitInvoice: vi.fn(),
    getTransmissionStatus: vi.fn(),
  };
  const db = {
    peppolTransmission: { findFirst: vi.fn(async () => null), create: vi.fn() },
    peppolParticipant: { findFirst: vi.fn(async () => null) },
    invoice: { create: vi.fn() },
  };
  return { adapter, db };
}

describe('PeppolOrchestrator demo guards', () => {
  it('pollAndProcessInbound: demo org returns 0 without polling the ASP', async () => {
    const { adapter, db } = makePeppolDeps();
    const orch = new PeppolOrchestrator(adapter as never, db as never);
    const n = await orch.pollAndProcessInbound('org_demo');
    expect(n).toBe(0);
    expect(adapter.pollInboundInvoices).not.toHaveBeenCalled();
  });

  it('pollAndProcessInbound: real org reaches the ASP poll', async () => {
    const { adapter, db } = makePeppolDeps();
    const orch = new PeppolOrchestrator(adapter as never, db as never);
    await orch.pollAndProcessInbound('org_real');
    expect(adapter.pollInboundInvoices).toHaveBeenCalledTimes(1);
  });

  it('processInboundInvoice: demo org returns null without touching the DB', async () => {
    const { adapter, db } = makePeppolDeps();
    const orch = new PeppolOrchestrator(adapter as never, db as never);
    const result = await orch.processInboundInvoice({
      payload: { documentId: 'd1', xml: '<x/>', receivedAt: new Date() } as never,
      organizationId: 'org_demo',
    });
    expect(result).toBeNull();
    expect(db.peppolTransmission.findFirst).not.toHaveBeenCalled();
  });
});

describe('submitToZatca demo guard', () => {
  function makeZatcaDb() {
    return {
      invoice: { findUniqueOrThrow: vi.fn(async () => ({})) },
      integrationConnection: { findFirst: vi.fn(async () => null) },
    };
  }

  it('demo org: returns without loading the invoice or contacting ZATCA', async () => {
    const db = makeZatcaDb();
    await expect(
      submitToZatca({ invoiceId: 'inv1', organizationId: 'org_demo' } as never, db as never),
    ).resolves.toBeUndefined();
    expect(db.invoice.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('real org: proceeds to load the invoice', async () => {
    const db = makeZatcaDb();
    // findUniqueOrThrow resolves to {}; the function then fails on the missing
    // ZATCA connection — proving it got past the demo guard into real work.
    await expect(
      submitToZatca({ invoiceId: 'inv1', organizationId: 'org_real' } as never, db as never),
    ).rejects.toThrow();
    expect(db.invoice.findUniqueOrThrow).toHaveBeenCalledTimes(1);
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});
