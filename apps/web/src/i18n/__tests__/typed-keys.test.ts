import { useTranslations } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { LeavesUnder, SubNamespacesOf, tDyn } from '../typed-keys';

// ---------------------------------------------------------------------------
// Static type-level assertions (compile-time only — never executed).
// ---------------------------------------------------------------------------

type Sample = 'status.active' | 'status.archived' | 'a.b.c' | 'a.b.d' | 'flat';

type Assert<T extends true> = T;
type Equals<A, B> = (<U>() => U extends A ? 1 : 2) extends <U>() => U extends B
  ? 1
  : 2
  ? true
  : false;
type Extends<A, B> = [A] extends [B] ? true : false;

// All expected sub-namespaces present.
type _SubA = Assert<Extends<'status', SubNamespacesOf<Sample>>>;
type _SubB = Assert<Extends<'a', SubNamespacesOf<Sample>>>;
type _SubC = Assert<Extends<'a.b', SubNamespacesOf<Sample>>>;
// `flat` is a leaf, NOT a sub-namespace.
type _SubD = Assert<Equals<Extends<'flat', SubNamespacesOf<Sample>>, false>>;

// Leaves under a sub-namespace.
type _LeafA = Assert<Equals<LeavesUnder<Sample, 'status'>, 'active' | 'archived'>>;
type _LeafB = Assert<Equals<LeavesUnder<Sample, 'a.b'>, 'c' | 'd'>>;

function _negativeTypeAssertions(
  tStatus: (key: 'status.active' | 'status.archived' | 'count') => string,
) {
  // Valid call compiles cleanly.
  tDyn(tStatus, 'status', 'active');
  // @ts-expect-error 'doesNotExist' is not a sub-namespace under tStatus
  tDyn(tStatus, 'doesNotExist', 'active');
  // @ts-expect-error 'missing' is not a leaf of status
  tDyn(tStatus, 'status', 'missing');
}

type _Refs = _SubA | _SubB | _SubC | _SubD | _LeafA | _LeafB;
const _typeOnly = null as unknown as _Refs;

// ---------------------------------------------------------------------------
// Runtime smoke — tDyn forwards arguments to the translator unchanged.
// ---------------------------------------------------------------------------

describe('tDyn', () => {
  it('concatenates subNs and key with a dot and forwards to t', () => {
    const calls: Array<[string, unknown]> = [];
    const fakeT = ((key: string, values?: unknown) => {
      calls.push([key, values]);
      return `value:${key}`;
    }) as unknown as ReturnType<typeof useTranslations>;
    const out = tDyn(
      fakeT as unknown as (key: 'status.active' | 'status.archived') => string,
      'status',
      'active',
    );
    expect(out).toBe('value:status.active');
    expect(calls).toEqual([['status.active', undefined]]);
  });

  it('forwards interpolation values', () => {
    const calls: Array<[string, unknown]> = [];
    const fakeT = ((key: string, values?: unknown) => {
      calls.push([key, values]);
      return 'ignored';
    }) as unknown as (key: 'group.label', values?: { name: string }) => string;
    tDyn(fakeT, 'group', 'label', { name: 'acme' });
    expect(calls).toEqual([['group.label', { name: 'acme' }]]);
  });

  it('keeps type-only assertions reachable for lint', () => {
    expect(_typeOnly).toBeNull();
    expect(typeof _negativeTypeAssertions).toBe('function');
  });
});
