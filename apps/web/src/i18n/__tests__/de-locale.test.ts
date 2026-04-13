// Wave 0 scaffold — implemented in Plan 05 (German locale + message parity)
// Tests fail by design until:
//   - Plan 05 adds 'de' to routing.locales
//   - Plan 05 creates apps/web/messages/de.json with full parity against en.json
//   - Plan 05 adds a 'de' entry to localeSettings with timeZone='Europe/Berlin', currency='EUR'
// Covers FOUND-03 (German locale routing + translation parity).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routing } from '../routing';

const MESSAGES_DIR = join(__dirname, '..', '..', '..', 'messages');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return [prefix];
  }
  const result: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const compound = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result.push(...flattenKeys(value, compound));
    } else {
      result.push(compound);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// routing.locales must include 'de'
// ---------------------------------------------------------------------------

describe('German locale routing (FOUND-03)', () => {
  it('includes "de" in routing.locales', () => {
    expect(routing.locales).toContain('de');
  });

  it('maintains existing locales', () => {
    expect(routing.locales).toContain('en');
    expect(routing.locales).toContain('pl');
    expect(routing.locales).toContain('ar');
  });
});

// ---------------------------------------------------------------------------
// messages/de.json parity against messages/en.json
// ---------------------------------------------------------------------------

describe('German message parity (FOUND-03)', () => {
  it('de.json exists and is valid JSON', () => {
    const raw = readFileSync(join(MESSAGES_DIR, 'de.json'), 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('every key present in en.json also exists in de.json', () => {
    const en = JSON.parse(readFileSync(join(MESSAGES_DIR, 'en.json'), 'utf-8'));
    const de = JSON.parse(readFileSync(join(MESSAGES_DIR, 'de.json'), 'utf-8'));
    const enKeys = new Set(flattenKeys(en));
    const deKeys = new Set(flattenKeys(de));

    const missing: string[] = [];
    for (const key of enKeys) {
      if (!deKeys.has(key)) missing.push(key);
    }
    expect(missing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// localeSettings exports a DE entry with correct timeZone + currency
// ---------------------------------------------------------------------------

describe('German localeSettings (FOUND-03)', () => {
  it('request.ts exports a localeSettings entry for de with Europe/Berlin + EUR', async () => {
    // next-intl's getRequestConfig wraps the settings, so we inspect the source
    // directly until Plan 05 extracts localeSettings into a named export.
    const requestSource = readFileSync(join(__dirname, '..', 'request.ts'), 'utf-8');
    expect(requestSource).toMatch(/de:\s*\{\s*timeZone:\s*['"]Europe\/Berlin['"]/);
    expect(requestSource).toMatch(/de:\s*\{[^}]*currency:\s*['"]EUR['"]/);
  });
});
