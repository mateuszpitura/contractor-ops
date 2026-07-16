/**
 * The Zapier app bundle test — the local equivalent of `zapier validate`.
 *
 * It asserts the assembled app definition is well-formed (schema-valid), that
 * every trigger derives from a real webhook catalog event, that every action
 * resolves to a real write operationId (count derived from the snapshot, never
 * hardcoded), and that the API-key header is wired. A writes-hidden spec is
 * exercised to prove the pre-flip posture (triggers-only, still valid).
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { OpenApiSnapshot } from '@contractor-ops/marketplace-manifests';
import { toSnakeKey, writeOperationIds } from '@contractor-ops/marketplace-manifests';
import { WEBHOOK_EVENT_TYPES } from '@contractor-ops/validators';
import { describe, expect, it } from 'vitest';
import type { Bundle, HttpRequestOptionsWithUrl, ZObject } from 'zapier-platform-core';

import { addApiKeyHeader, buildZapierApp, oauth2Authentication } from '../index';

// The platform's own compile + schema-clean + validate pipeline — the same
// routine `zapier validate` runs, which serializes perform functions before
// checking them against the app schema.
const require = createRequire(import.meta.url);
const { prepareApp, validateApp } = require('zapier-platform-core/src/tools/schema') as {
  prepareApp: (app: unknown) => unknown;
  validateApp: (app: unknown) => unknown[];
};

function schemaErrors(app: unknown): unknown[] {
  return validateApp(prepareApp(app));
}

const spec = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/openapi.snapshot.fixture.json'), 'utf8'),
) as OpenApiSnapshot;

const events = [...WEBHOOK_EVENT_TYPES];
const app = buildZapierApp(spec);

describe('app definition is schema-valid (zapier validate equivalent)', () => {
  it('passes the platform schema validation with zero errors', () => {
    expect(schemaErrors(app)).toEqual([]);
  });

  it('pins a semver version and the installed platform version', () => {
    expect(app.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(app.platformVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('authentication wires the custom API key', () => {
  it('ships the custom API-key scheme (co_live_/co_test_)', () => {
    expect(app.authentication?.type).toBe('custom');
    expect(JSON.stringify(app.authentication?.fields)).toMatch(/apiKey/);
    expect(JSON.stringify(app.authentication?.fields)).toMatch(/co_live_/);
  });

  it('injects Authorization: Bearer <apiKey> on every request', async () => {
    const request: HttpRequestOptionsWithUrl = {
      url: 'https://api.contractor-ops.com/v1/contractors',
      headers: {},
    };
    const bundle = { authData: { apiKey: 'co_test_abc123' } } as unknown as Bundle;
    const z = {} as unknown as ZObject;
    const out = await addApiKeyHeader(request, z, bundle);
    expect(out.headers?.Authorization).toBe('Bearer co_test_abc123');
  });

  it('scaffolds an optional OAuth 2.0 authorization-code variant, not wired by default', () => {
    expect(oauth2Authentication.type).toBe('oauth2');
    expect(oauth2Authentication.oauth2Config?.authorizeUrl).toBeDefined();
    expect(app.authentication?.type).not.toBe('oauth2');
  });
});

describe('triggers map 1:1 to the webhook event catalog', () => {
  const triggerKeys = Object.keys(app.triggers ?? {});

  it('emits one hook trigger per catalog event (>= 8)', () => {
    expect(triggerKeys).toHaveLength(events.length);
    expect(triggerKeys.length).toBeGreaterThanOrEqual(8);
    for (const key of triggerKeys) {
      expect(app.triggers?.[key].operation.type).toBe('hook');
    }
  });

  it('every trigger key derives from a real catalog event', () => {
    expect(triggerKeys.sort()).toEqual(events.map(toSnakeKey).sort());
  });
});

describe('actions map to real write operationIds — count derived from the snapshot', () => {
  it('emits one action per write operationId (the six named write actions)', () => {
    const writes = writeOperationIds(spec);
    const createKeys = Object.keys(app.creates ?? {});
    expect(createKeys).toHaveLength(writes.length);
    expect(writes.length).toBeGreaterThanOrEqual(6);
    expect(createKeys.sort()).toEqual(writes.map(toSnakeKey).sort());
  });

  it('emits zero actions but stays valid when the snapshot hides writes (pre-flip)', () => {
    const readsOnly: OpenApiSnapshot = {
      ...spec,
      paths: { '/v1/contractors': { get: spec.paths['/v1/contractors']?.get } },
    };
    const darkApp = buildZapierApp(readsOnly);
    expect(writeOperationIds(readsOnly)).toHaveLength(0);
    expect(Object.keys(darkApp.creates ?? {})).toHaveLength(0);
    expect(Object.keys(darkApp.triggers ?? {})).toHaveLength(events.length);
    expect(schemaErrors(darkApp)).toEqual([]);
  });
});
