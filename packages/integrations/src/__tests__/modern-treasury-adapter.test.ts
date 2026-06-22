// Terminal-RED Wave-0 scaffold for the Modern Treasury payout-initiation seam.
//
// RED until `../adapters/modern-treasury-adapter.js` exists, exporting a
// deterministic `MockModernTreasuryAdapter` (the shipped default) and a
// flag-dark `LiveModernTreasuryAdapter` behind the same `PayoutInitiationAdapter`
// interface. The import below resolves to a not-yet-existing module, so the
// suite fails at module resolution (Cannot find module) — the right reason, not
// a typo or an assertion bug.
//
// This pins the payout-initiation contract a downstream wave must satisfy,
// mirroring the tin-match client seam (interface + deterministic mock default +
// live-dark concrete):
//   - `initiatePayout` returns a deterministic payment_order shape whose status
//     is a member of the documented pending -> ... -> reconciled lifecycle
//   - the same input always yields the same output (no network, no randomness)
//   - the live adapter refuses to originate while it stays flag-dark

import { describe, expect, it } from 'vitest';
import type {
  PayoutInitiationAdapter,
  PayoutOrderStatus,
} from '../adapters/modern-treasury-adapter.js';
import {
  LiveModernTreasuryAdapter,
  MockModernTreasuryAdapter,
} from '../adapters/modern-treasury-adapter.js';

const PAYMENT_ORDER_LIFECYCLE: PayoutOrderStatus[] = [
  'pending',
  'approved',
  'processing',
  'sent',
  'completed',
  'reconciled',
];

const payoutRequest = {
  idempotencyKey: 'po_INV-2026-001',
  amountMinor: 50_000,
  currency: 'USD',
  receiverName: 'Jan Kowalski',
  routingNumber: '021000021',
  accountNumber: '000123456789',
} as const;

describe('MockModernTreasuryAdapter', () => {
  const adapter: PayoutInitiationAdapter = new MockModernTreasuryAdapter();

  it('returns a payment_order with an id and a lifecycle status', async () => {
    const order = await adapter.initiatePayout(payoutRequest);
    expect(order.id).toBeTruthy();
    expect(PAYMENT_ORDER_LIFECYCLE).toContain(order.status);
  });

  it('echoes the requested amount and currency on the payment_order', async () => {
    const order = await adapter.initiatePayout(payoutRequest);
    expect(order.amountMinor).toBe(payoutRequest.amountMinor);
    expect(order.currency).toBe(payoutRequest.currency);
  });

  it('is deterministic — the same idempotency key yields the same order id', async () => {
    const first = await adapter.initiatePayout(payoutRequest);
    const second = await adapter.initiatePayout(payoutRequest);
    expect(second.id).toBe(first.id);
  });

  it('reports a payout status that is also a member of the lifecycle', async () => {
    const order = await adapter.initiatePayout(payoutRequest);
    const status = await adapter.getPayoutStatus(order.id);
    expect(PAYMENT_ORDER_LIFECYCLE).toContain(status);
  });
});

describe('LiveModernTreasuryAdapter', () => {
  it('refuses to originate a payout while the live path is flag-dark', async () => {
    const adapter: PayoutInitiationAdapter = new LiveModernTreasuryAdapter();
    await expect(adapter.initiatePayout(payoutRequest)).rejects.toThrow();
  });
});
