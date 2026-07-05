/**
 * The marketplace definitions GENERATE from the OpenAPI snapshot + the webhook
 * event catalog; no hand-authored per-platform lists.
 *
 * Every generated trigger maps to a real catalog event; every action maps to a
 * real write operationId in the snapshot. The write-action count is derived from
 * the snapshot's write set (zero while the write routes are hidden, N once they
 * are un-hidden) — never a hardcoded number.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WEBHOOK_EVENT_TYPES } from '@contractor-ops/validators';
import { describe, expect, it } from 'vitest';

import { generateManifests } from '../index';
import type { OpenApiSnapshot } from '../load-spec';
import { readOperationIds, writeOperationIds } from '../load-spec';

const spec = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/openapi.snapshot.fixture.json'), 'utf8'),
) as OpenApiSnapshot;

const events = [...WEBHOOK_EVENT_TYPES];

describe('load-spec operation classification', () => {
  it('extracts write operationIds (POST/PATCH/PUT/DELETE) from the snapshot', () => {
    expect(writeOperationIds(spec).sort()).toEqual(
      ['approveInvoice', 'createContractor', 'createInvoice'].sort(),
    );
  });

  it('extracts read operationIds (GET) from the snapshot', () => {
    expect(readOperationIds(spec).sort()).toEqual(
      ['getContractor', 'listContractors', 'listInvoices'].sort(),
    );
  });
});

describe('generateManifests — Zapier / n8n / Make from one source', () => {
  const manifests = generateManifests(spec, events);

  it('emits one Zapier trigger per catalog event, each mapping to a real event', () => {
    const triggerEvents = manifests.zapier.triggers.map(t => t.event);
    expect(triggerEvents.sort()).toEqual([...events].sort());
    for (const trigger of manifests.zapier.triggers) {
      expect(events).toContain(trigger.event);
      expect(trigger.key).toBeTruthy();
    }
  });

  it('emits one Zapier create per write operationId — count derived from the snapshot, not hardcoded', () => {
    const writes = writeOperationIds(spec);
    expect(manifests.zapier.creates).toHaveLength(writes.length);
    for (const create of manifests.zapier.creates) {
      expect(writes).toContain(create.operationId);
    }
  });

  it('wires custom API-key authentication (co_live_/co_test_) on the Zapier app', () => {
    expect(manifests.zapier.authentication.type).toBe('custom');
    expect(JSON.stringify(manifests.zapier.authentication)).toMatch(/apiKey/i);
  });

  it('emits n8n node operations for every write op and trigger events for every catalog event', () => {
    const n8nOps = manifests.n8n.node.operations.map(o => o.operationId);
    expect(n8nOps.sort()).toEqual(writeOperationIds(spec).sort());
    const n8nTriggerEvents = manifests.n8n.trigger.events;
    expect([...n8nTriggerEvents].sort()).toEqual([...events].sort());
  });

  it('emits a Make blueprint with modules for writes and instant triggers for events', () => {
    const moduleOps = manifests.make.modules.map(m => m.operationId);
    expect(moduleOps.sort()).toEqual(writeOperationIds(spec).sort());
    const makeTriggerEvents = manifests.make.instantTriggers.map(t => t.event);
    expect(makeTriggerEvents.sort()).toEqual([...events].sort());
  });

  it('does not throw and emits zero creates when the snapshot hides writes (pre-flip posture)', () => {
    const readsOnly: OpenApiSnapshot = {
      ...spec,
      paths: { '/v1/contractors': { get: spec.paths['/v1/contractors']?.get } },
    };
    const m = generateManifests(readsOnly, events);
    expect(writeOperationIds(readsOnly)).toHaveLength(0);
    expect(m.zapier.creates).toHaveLength(0);
    expect(m.zapier.triggers.length).toBe(events.length);
  });
});
