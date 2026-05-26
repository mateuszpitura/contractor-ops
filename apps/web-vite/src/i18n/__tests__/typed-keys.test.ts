/**
 * Runtime smoke for the web-vite `typed-keys` helpers. The original
 * next-intl typed-keys module exported a heavy generic surface (LeavesUnder /
 * SubNamespacesOf / type-level assertions); the web-vite port slimmed this
 * down to the runtime helpers actually consumed by ported call sites:
 * `tKey` (pass-through), `tDyn` / `tDynLoose` (dotted-key composition), and
 * `tHas` (missing-message guard).
 */

import { describe, expect, it, vi } from 'vitest';
import type { LooseTranslator } from '../typed-keys.js';
import { tDyn, tDynLoose, tHas, tKey } from '../typed-keys.js';

describe('tKey', () => {
  it('forwards key and values to the translator unchanged', () => {
    const t = vi.fn((key: string, _values?: unknown) => `out:${key}`);
    const result = tKey(t as LooseTranslator, 'flat.key', { name: 'acme' });
    expect(t).toHaveBeenCalledWith('flat.key', { name: 'acme' });
    expect(result).toBe('out:flat.key');
  });

  it('omits values when caller passes only the key', () => {
    const t = vi.fn((key: string) => `out:${key}`);
    tKey(t as LooseTranslator, 'just.key');
    expect(t).toHaveBeenCalledWith('just.key', undefined);
  });
});

describe('tDyn', () => {
  it('joins subNs and key with a dot and forwards to t', () => {
    const calls: [string, unknown][] = [];
    const fakeT: LooseTranslator = (key: string, values?: unknown) => {
      calls.push([key, values]);
      return `value:${key}`;
    };
    const out = tDyn(fakeT, 'status', 'active');
    expect(out).toBe('value:status.active');
    expect(calls).toEqual([['status.active', undefined]]);
  });

  it('forwards interpolation values', () => {
    const calls: [string, unknown][] = [];
    const fakeT: LooseTranslator = (key: string, values?: unknown) => {
      calls.push([key, values]);
      return 'ignored';
    };
    tDyn(fakeT, 'group', 'label', { name: 'acme' });
    expect(calls).toEqual([['group.label', { name: 'acme' }]]);
  });
});

describe('tDynLoose', () => {
  it('composes subNs.key and forwards arguments through', () => {
    const t = vi.fn((key: string, _values?: unknown) => `loose:${key}`);
    const out = tDynLoose(t as LooseTranslator, 'errors', 'notFound', { id: 'x' });
    expect(out).toBe('loose:errors.notFound');
    expect(t).toHaveBeenCalledWith('errors.notFound', { id: 'x' });
  });
});

describe('tHas', () => {
  it('returns true when translator yields a different string', () => {
    const t: LooseTranslator = (key: string) => `Resolved: ${key}`;
    expect(tHas(t, 'nav.dashboard')).toBe(true);
  });

  it('returns false when translator echoes the key (missing entry)', () => {
    const t: LooseTranslator = (key: string) => key;
    expect(tHas(t, 'unknown.key')).toBe(false);
  });

  it('returns false when translator returns a MISSING_MESSAGE sentinel', () => {
    const t: LooseTranslator = (_key: string) => 'MISSING_MESSAGE: nav.foo';
    expect(tHas(t, 'nav.foo')).toBe(false);
  });
});
