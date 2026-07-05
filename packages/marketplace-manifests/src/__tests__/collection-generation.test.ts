/**
 * Postman + Insomnia collections GENERATE from the OpenAPI snapshot: every
 * path+method is exactly one request; auth + base URL are variables ({{apiKey}} /
 * {{baseUrl}}); the output is deterministic so a `generate --check` diff-gate
 * fails on drift; no embedded literal key.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { generateInsomnia } from '../generate-insomnia';
import { generatePostman } from '../generate-postman';
import type { OpenApiSnapshot } from '../load-spec';
import { requestCount } from '../load-spec';

const spec = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/openapi.snapshot.fixture.json'), 'utf8'),
) as OpenApiSnapshot;

describe('generatePostman', () => {
  const collection = generatePostman(spec);

  it('is a Postman v2.1 collection', () => {
    expect(collection.info.schema).toContain('v2.1.0');
  });

  it('emits exactly one request per snapshot path+method', () => {
    const items = collection.item.flatMap(function flatten(i): unknown[] {
      return 'item' in i && Array.isArray(i.item) ? i.item.flatMap(flatten) : [i];
    });
    expect(items).toHaveLength(requestCount(spec));
  });

  it('wires {{baseUrl}} + {{apiKey}} as variables, never a literal key', () => {
    const raw = JSON.stringify(collection);
    expect(raw).toContain('{{baseUrl}}');
    expect(raw).toContain('{{apiKey}}');
    expect(raw).not.toMatch(/co_(live|test)_[A-Za-z0-9]/);
  });

  it('is deterministic (a re-generation is byte-identical — the drift-check primitive)', () => {
    expect(JSON.stringify(generatePostman(spec))).toBe(JSON.stringify(collection));
  });
});

describe('generateInsomnia', () => {
  const workspace = generateInsomnia(spec);

  it('is an Insomnia v4 export', () => {
    expect(workspace._type).toBe('export');
    expect(workspace.export_format).toBe(4);
  });

  it('emits one request resource per snapshot path+method plus a base environment', () => {
    const requests = workspace.resources.filter(r => r._type === 'request');
    expect(requests).toHaveLength(requestCount(spec));
    const env = workspace.resources.find(r => r._type === 'environment');
    expect(env).toBeDefined();
    expect(JSON.stringify(env)).toMatch(/baseUrl/);
    expect(JSON.stringify(env)).toMatch(/apiKey/);
  });

  it('is deterministic (drift-check primitive)', () => {
    expect(JSON.stringify(generateInsomnia(spec))).toBe(JSON.stringify(workspace));
  });
});
