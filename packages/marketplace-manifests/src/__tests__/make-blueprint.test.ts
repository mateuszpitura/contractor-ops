/**
 * The Make.com app blueprint generates from the same OpenAPI snapshot + webhook
 * event catalog as the other manifests: modules are the write actions, instant
 * triggers are the catalog events, and the connection is the apiKey bearer. The
 * committed `blueprint.json` is validated for shape and for the absence of any
 * embedded secret (the key is user-supplied at connection time).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WEBHOOK_EVENT_TYPES } from '@contractor-ops/validators';
import { describe, expect, it } from 'vitest';
import type { MakeBlueprint } from '../generate-make';
import { generateMake } from '../generate-make';
import type { OpenApiSnapshot } from '../load-spec';
import { writeOperationIds } from '../load-spec';

const spec = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/openapi.snapshot.fixture.json'), 'utf8'),
) as OpenApiSnapshot;

const events = [...WEBHOOK_EVENT_TYPES];

const COMMITTED_BLUEPRINT_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'apps/public-api/marketplace/make/blueprint.json',
);

describe('generateMake', () => {
  const blueprint = generateMake(spec, events);

  it('wires an apiKey connection carrying the bearer prefix', () => {
    expect(blueprint.connection.type).toBe('apiKey');
    expect(blueprint.connection.apiKeyHeader).toBe('Authorization');
    expect(blueprint.connection.apiKeyPrefix).toBe('Bearer ');
  });

  it('emits one module per write operationId and one instant trigger per event', () => {
    expect(blueprint.modules.map(m => m.operationId).sort()).toEqual(
      writeOperationIds(spec).sort(),
    );
    expect(blueprint.instantTriggers.map(t => t.event).sort()).toEqual([...events].sort());
  });

  it('is deterministic (a re-generation is byte-identical — the drift-check primitive)', () => {
    expect(JSON.stringify(generateMake(spec, events))).toBe(JSON.stringify(blueprint));
  });
});

describe('committed blueprint.json', () => {
  const committed = JSON.parse(readFileSync(COMMITTED_BLUEPRINT_PATH, 'utf8')) as MakeBlueprint;

  it('parses to a well-formed blueprint (name, version, connection, modules, triggers)', () => {
    expect(committed.name).toBeTruthy();
    expect(typeof committed.version).toBe('number');
    expect(committed.connection.type).toBe('apiKey');
    expect(Array.isArray(committed.modules)).toBe(true);
    expect(committed.modules.length).toBeGreaterThan(0);
    expect(committed.instantTriggers.map(t => t.event).sort()).toEqual([...events].sort());
  });

  it('embeds no API key — the credential is supplied by the connection at runtime', () => {
    const raw = JSON.stringify(committed);
    expect(raw).not.toMatch(/co_(live|test)_[A-Za-z0-9]/);
  });
});
