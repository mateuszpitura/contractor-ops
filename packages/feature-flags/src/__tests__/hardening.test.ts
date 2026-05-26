import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getFlagClient, setFlagClientForTesting, shutdownFlagClients } from '../client';
import { evaluate } from '../evaluator';
import { buildFlagBag, emptyFlagBag } from '../flag-bag';
import { FLAG_KEYS, FLAGS } from '../registry';
import type { EvalContext } from '../schemas';

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

  it('evaluate() through a stub client returns code-declared defaults for non-killWhenUnknown flags', () => {
    process.env.UNLEASH_URL_EU = '';
    process.env.UNLEASH_API_TOKEN_EU = '';
    // Plain default-false flag passes through the stub fallback unchanged.
    expect(evaluate('module.legal-approval', euCtx).enabled).toBe(false);
  });

  it('evaluate() forces killWhenUnknown flags to false when Unleash is unreachable', () => {
    // Phase 72 fix — kill-switches with killWhenUnknown:true MUST resolve to
    // false during an Unleash outage, otherwise their `default: true` keeps
    // the gated feature live exactly when ops needs to kill it.
    process.env.UNLEASH_URL_EU = '';
    process.env.UNLEASH_API_TOKEN_EU = '';
    const result = evaluate('killswitch.ai-invoice-parser', euCtx);
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe('kill-when-unknown');
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
  // bag.values intentionally uses a plain-object prototype (not Object.create(null))
  // so the bag survives RSC serialization across the Server → Client boundary —
  // RSC rejects null-prototype objects with "Classes or null prototypes are not
  // supported". Prototype-pollution defense lives in the isEnabled strict
  // `=== true` check below, not in the prototype shape.
  it('bag.values is a plain object that round-trips through structuredClone', () => {
    setFlagClientForTesting('EU', { isEnabled: (_n, _c, fb) => fb });
    const bag = buildFlagBag(euCtx);
    expect(Object.getPrototypeOf(bag.values)).toBe(Object.prototype);
    expect(() => structuredClone(bag.values)).not.toThrow();
  });

  it('isEnabled returns false for non-literal string access', () => {
    setFlagClientForTesting('EU', { isEnabled: (_n, _c, fb) => fb });
    const bag = buildFlagBag(euCtx);
    // Cast away type safety to simulate a bug that reads an unknown key.
    // The isEnabled helper uses strict `=== true` so undefined never leaks,
    // and inherited keys like `constructor` never resolve to `true`.
    const sneakyKey = 'constructor' as unknown as Parameters<typeof bag.isEnabled>[0];
    expect(bag.isEnabled(sneakyKey)).toBe(false);
  });

  it('emptyFlagBag is also a plain serializable object', () => {
    const bag = emptyFlagBag();
    expect(Object.getPrototypeOf(bag.values)).toBe(Object.prototype);
    expect(() => structuredClone(bag.values)).not.toThrow();
  });

  it('lazyFlagBag isEnabled is null-prototype safe (constructor key returns false)', async () => {
    // The lazy bag's public type intentionally omits `values` so a serializer
    // (JSON.stringify, logger dump) cannot accidentally trigger full
    // materialization. Prototype safety is therefore verified through the
    // isEnabled boundary — a sneaky inherited key like 'constructor' must
    // resolve to false, mirroring the eager bag's `=== true` discipline.
    const { lazyFlagBag } = await import('../flag-bag');
    setFlagClientForTesting('EU', { isEnabled: (_n, _c, fb) => fb });
    const bag = lazyFlagBag(euCtx);
    const sneakyKey = 'constructor' as unknown as Parameters<typeof bag.isEnabled>[0];
    expect(bag.isEnabled(sneakyKey)).toBe(false);
  });
});
