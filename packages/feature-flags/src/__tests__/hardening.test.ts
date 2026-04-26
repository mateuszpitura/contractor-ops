import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getFlagClient, setFlagClientForTesting, shutdownFlagClients } from '../client.js';
import { evaluate } from '../evaluator.js';
import { buildFlagBag, emptyFlagBag } from '../flag-bag.js';
import { FLAG_KEYS, FLAGS } from '../registry.js';
import type { EvalContext } from '../schemas.js';

const euCtx: EvalContext = {
  organizationId: 'org_eu',
  region: 'EU',
};

const meCtx: EvalContext = {
  organizationId: 'org_me',
  region: 'ME',
};

const originalEnv = { ...process.env };

beforeEach(() => {
  shutdownFlagClients();
});

afterEach(() => {
  process.env = { ...originalEnv };
});

// ---------------------------------------------------------------------------
// Registry immutability (defense-in-depth against malicious mutation)
// ---------------------------------------------------------------------------

describe('registry immutability', () => {
  it('FLAGS is frozen at the top level', () => {
    expect(Object.isFrozen(FLAGS)).toBe(true);
  });

  it('FLAGS entries are frozen (cannot flip jurisdiction at runtime)', () => {
    for (const def of Object.values(FLAGS)) {
      expect(Object.isFrozen(def)).toBe(true);
    }
  });

  it('rejects attempts to add new flags at runtime', () => {
    expect(() => {
      (FLAGS as Record<string, unknown>)['evil.flag'] = { jurisdiction: 'ANY' };
    }).toThrow();
  });

  it('rejects attempts to rewrite jurisdiction at runtime', () => {
    expect(() => {
      (FLAGS['integration.gulf-payments'] as { jurisdiction: string }).jurisdiction = 'EU';
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------
// emptyFlagBag — fail-closed default for missing tenant context
// ---------------------------------------------------------------------------

describe('emptyFlagBag', () => {
  it('returns false for every declared flag (fail-closed)', () => {
    const bag = emptyFlagBag();
    for (const key of FLAG_KEYS) {
      expect(bag.values[key], `${key} should be false`).toBe(false);
      expect(bag.isEnabled(key), `${key}.isEnabled should be false`).toBe(false);
    }
  });

  it('returns false even for kill-switches (safe during unknown contexts)', () => {
    // Kill-switches default to true under normal evaluation, but an unknown
    // tenant context means we genuinely don't know if the feature should work
    // — staying off is the safer choice because the user isn't reaching the
    // gated code path anyway.
    expect(emptyFlagBag().values['killswitch.ai-invoice-parser']).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getFlagClient — graceful stub when env is missing (no throw, no crash)
// ---------------------------------------------------------------------------

describe('getFlagClient with missing env', () => {
  it('returns a stub client when UNLEASH_URL_EU is missing', () => {
    process.env.UNLEASH_URL_EU = '';
    process.env.UNLEASH_API_TOKEN_EU = '';
    const client = getFlagClient('EU');
    expect(client).toBeDefined();
    // The stub client returns the fallback argument, so a flag with default
    // `false` evaluates to `false`.
    expect(client.isEnabled('x', {}, false)).toBe(false);
    expect(client.isEnabled('x', {}, true)).toBe(true);
  });

  it('evaluate() through a stub client returns code-declared defaults', () => {
    process.env.UNLEASH_URL_EU = '';
    process.env.UNLEASH_API_TOKEN_EU = '';
    expect(evaluate('module.legal-approval', euCtx).enabled).toBe(false);
    expect(evaluate('killswitch.ai-invoice-parser', euCtx).enabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Jurisdiction invariant — cannot be bypassed via ANY client behaviour
// ---------------------------------------------------------------------------

describe('jurisdiction invariant is unbypassable', () => {
  it('EU ctx + Unleash returning true for ME flag → still false', () => {
    setFlagClientForTesting('EU', {
      isEnabled: () => true, // imagine Unleash misconfig enabling a ME flag in EU
    });
    expect(evaluate('integration.gulf-payments', euCtx).enabled).toBe(false);
  });

  it('ME ctx + Unleash returning true for EU flag → still false', () => {
    setFlagClientForTesting('ME', {
      isEnabled: () => true,
    });
    expect(evaluate('integration.sepa-instant', meCtx).enabled).toBe(false);
  });

  it('jurisdiction mismatch short-circuits before consulting Unleash', () => {
    let clientConsulted = false;
    setFlagClientForTesting('EU', {
      isEnabled: () => {
        clientConsulted = true;
        return true;
      },
    });
    evaluate('integration.gulf-payments', euCtx);
    expect(clientConsulted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildFlagBag never throws — evaluator is expected to be total
// ---------------------------------------------------------------------------

describe('buildFlagBag total', () => {
  it('produces a value for every declared flag even when Unleash fails', () => {
    setFlagClientForTesting('EU', {
      isEnabled: () => {
        // Simulate SDK returning something unexpected — it should still fall
        // back to the fallback argument passed by our evaluator.
        return false;
      },
    });
    const bag = buildFlagBag(euCtx);
    for (const key of FLAG_KEYS) {
      expect(bag.values).toHaveProperty(key);
      expect(typeof bag.values[key]).toBe('boolean');
    }
  });

  it('returns code defaults when the client throws (defense in depth)', () => {
    setFlagClientForTesting('EU', {
      isEnabled: () => {
        throw new Error('simulated broken strategy');
      },
    });
    const bag = buildFlagBag(euCtx);
    // module.legal-approval default: false
    expect(bag.values['module.legal-approval']).toBe(false);
    // killswitch.ai-invoice-parser default: true
    expect(bag.values['killswitch.ai-invoice-parser']).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Prototype-pollution defense
// ---------------------------------------------------------------------------

describe('flag bag prototype safety', () => {
  it('bag.values has null prototype (no inherited keys)', () => {
    setFlagClientForTesting('EU', { isEnabled: (_n, _c, fb) => fb });
    const bag = buildFlagBag(euCtx);
    expect(Object.getPrototypeOf(bag.values)).toBeNull();
    // A classic prototype-pollution probe — must be undefined, not a function.
    expect((bag.values as unknown as Record<string, unknown>).hasOwnProperty).toBeUndefined();
    expect((bag.values as unknown as Record<string, unknown>).__proto__).toBeUndefined();
  });

  it('isEnabled returns false for non-literal string access', () => {
    setFlagClientForTesting('EU', { isEnabled: (_n, _c, fb) => fb });
    const bag = buildFlagBag(euCtx);
    // Cast away type safety to simulate a bug that reads an unknown key.
    // The isEnabled helper uses strict `=== true` so undefined never leaks.
    const sneakyKey = 'constructor' as unknown as Parameters<typeof bag.isEnabled>[0];
    expect(bag.isEnabled(sneakyKey)).toBe(false);
  });

  it('emptyFlagBag also has null prototype', () => {
    const bag = emptyFlagBag();
    expect(Object.getPrototypeOf(bag.values)).toBeNull();
  });

  it('lazyFlagBag inherits the same null-prototype bag when materialized', async () => {
    const { lazyFlagBag } = await import('../flag-bag.js');
    setFlagClientForTesting('EU', { isEnabled: (_n, _c, fb) => fb });
    const bag = lazyFlagBag(euCtx);
    expect(Object.getPrototypeOf(bag.values)).toBeNull();
    const sneakyKey = 'constructor' as unknown as Parameters<typeof bag.isEnabled>[0];
    expect(bag.isEnabled(sneakyKey)).toBe(false);
  });
});
