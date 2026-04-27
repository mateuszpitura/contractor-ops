import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FlagClient } from '../client.js';
import { setFlagClientForTesting, shutdownFlagClients } from '../client.js';
import {
  __resetClassificationDisclaimerGateForTesting,
  evaluate,
  evaluateAgainst,
  registerClassificationDisclaimerGate,
} from '../evaluator.js';
import { buildFlagBag } from '../flag-bag.js';
import { FLAG_KEYS, FLAGS } from '../registry.js';
import type { EvalContext, FlagDefinition } from '../schemas.js';
import { flagDefinitionSchema } from '../schemas.js';

function fakeClient(overrides: Partial<Record<string, boolean>> = {}): FlagClient {
  return {
    isEnabled: (name, _ctx, fallback) => overrides[name] ?? fallback,
  };
}

const euCtx: EvalContext = {
  organizationId: 'org_eu',
  region: 'EU',
  userId: 'user_eu',
  countryCode: 'DE',
  tier: 'PRO',
  role: 'admin',
  authMode: 'session',
};

const meCtx: EvalContext = {
  organizationId: 'org_me',
  region: 'ME',
  userId: 'user_me',
  countryCode: 'SA',
  tier: 'ENTERPRISE',
  role: 'admin',
  authMode: 'session',
};

beforeEach(() => {
  shutdownFlagClients();
});

describe('registry', () => {
  it('every FLAGS entry validates against the Zod schema', () => {
    for (const def of Object.values(FLAGS)) {
      const parsed = flagDefinitionSchema.safeParse(def);
      expect(parsed.success, `invalid flag: ${def.key}`).toBe(true);
    }
  });

  it('FLAG_KEYS matches object keys of FLAGS', () => {
    expect(new Set(FLAG_KEYS)).toEqual(new Set(Object.keys(FLAGS)));
  });

  it('every flag key matches the namespace.key regex', () => {
    const re = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;
    for (const key of FLAG_KEYS) {
      expect(key, `malformed key: ${key}`).toMatch(re);
    }
  });
});

describe('evaluateAgainst — jurisdiction short-circuit', () => {
  const meOnly: FlagDefinition = {
    key: 'integration.gulf-payments',
    description: 'ME only',
    default: false,
    category: 'integration',
    jurisdiction: 'ME',
    owner: 'test',
  };
  const euOnly: FlagDefinition = {
    key: 'integration.sepa-instant',
    description: 'EU only',
    default: false,
    category: 'integration',
    jurisdiction: 'EU',
    owner: 'test',
  };
  const anyFlag: FlagDefinition = {
    key: 'module.legal-approval',
    description: 'any',
    default: false,
    category: 'module',
    jurisdiction: 'ANY',
    owner: 'test',
  };

  it('returns false for EU ctx on ME flag even when Unleash says true', () => {
    const client = fakeClient({ 'integration.gulf-payments': true });
    const result = evaluateAgainst(meOnly, euCtx, client);
    expect(result).toEqual({ enabled: false, reason: 'jurisdiction-mismatch' });
  });

  it('returns false for ME ctx on EU flag even when Unleash says true', () => {
    const client = fakeClient({ 'integration.sepa-instant': true });
    const result = evaluateAgainst(euOnly, meCtx, client);
    expect(result).toEqual({ enabled: false, reason: 'jurisdiction-mismatch' });
  });

  it('consults Unleash when jurisdiction matches', () => {
    const client = fakeClient({ 'integration.gulf-payments': true });
    const result = evaluateAgainst(meOnly, meCtx, client);
    expect(result).toEqual({ enabled: true, reason: 'unleash' });
  });

  it('ANY jurisdiction consults Unleash for both regions', () => {
    const client = fakeClient({ 'module.legal-approval': true });
    expect(evaluateAgainst(anyFlag, euCtx, client).enabled).toBe(true);
    expect(evaluateAgainst(anyFlag, meCtx, client).enabled).toBe(true);
  });
});

describe('evaluateAgainst — fallback', () => {
  it('returns code default when Unleash has no opinion', () => {
    const def: FlagDefinition = {
      key: 'module.legal-approval',
      description: 'test',
      default: false,
      category: 'module',
      jurisdiction: 'ANY',
      owner: 'test',
    };
    const result = evaluateAgainst(def, euCtx, fakeClient());
    expect(result).toEqual({ enabled: false, reason: 'unleash' });
  });

  it('kill-switch default true resolves true when Unleash has no opinion', () => {
    const def: FlagDefinition = {
      key: 'killswitch.ai-invoice-parser',
      description: 'test',
      default: true,
      category: 'kill-switch',
      jurisdiction: 'ANY',
      owner: 'test',
    };
    const result = evaluateAgainst(def, euCtx, fakeClient());
    expect(result).toEqual({ enabled: true, reason: 'unleash' });
  });
});

describe('evaluate + client injection', () => {
  it('routes to the client matching ctx.region', () => {
    setFlagClientForTesting('EU', fakeClient({ 'module.legal-approval': true }));
    setFlagClientForTesting('ME', fakeClient({ 'module.legal-approval': false }));

    expect(evaluate('module.legal-approval', euCtx).enabled).toBe(true);
    expect(evaluate('module.legal-approval', meCtx).enabled).toBe(false);
  });

  it('gulf-payments still false for EU ctx even if EU client says true (misconfigured Unleash)', () => {
    setFlagClientForTesting('EU', fakeClient({ 'integration.gulf-payments': true }));
    expect(evaluate('integration.gulf-payments', euCtx).enabled).toBe(false);
  });
});

describe('buildFlagBag', () => {
  it('returns a boolean for every declared flag', () => {
    setFlagClientForTesting('EU', fakeClient());
    const bag = buildFlagBag(euCtx);
    for (const key of FLAG_KEYS) {
      expect(typeof bag.values[key]).toBe('boolean');
    }
  });

  it('isEnabled matches values', () => {
    setFlagClientForTesting('EU', fakeClient({ 'module.legal-approval': true }));
    const bag = buildFlagBag(euCtx);
    expect(bag.isEnabled('module.legal-approval')).toBe(bag.values['module.legal-approval']);
  });
});

// ---------------------------------------------------------------------------
// Phase 72 hardening — disclaimer-gate override surfaces a distinct reason
// ---------------------------------------------------------------------------

describe('evaluate — classification disclaimer gate override', () => {
  afterEach(() => {
    __resetClassificationDisclaimerGateForTesting();
  });

  it('returns reason "disclaimer-pending" (NOT "unleash") when override fires', () => {
    setFlagClientForTesting('EU', fakeClient({ 'module.classification-engine': true }));
    registerClassificationDisclaimerGate(() => false); // disclaimer NOT approved
    const result = evaluate('module.classification-engine', euCtx);
    expect(result).toEqual({ enabled: false, reason: 'disclaimer-pending' });
  });

  it('passes through to Unleash result when all disclaimers are approved', () => {
    setFlagClientForTesting('EU', fakeClient({ 'module.classification-engine': true }));
    registerClassificationDisclaimerGate(() => true);
    const result = evaluate('module.classification-engine', euCtx);
    expect(result).toEqual({ enabled: true, reason: 'unleash' });
  });

  it('does not invoke the gate when Unleash already returned false', () => {
    setFlagClientForTesting('EU', fakeClient({ 'module.classification-engine': false }));
    let gateCalled = false;
    registerClassificationDisclaimerGate(() => {
      gateCalled = true;
      return false;
    });
    const result = evaluate('module.classification-engine', euCtx);
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe('unleash');
    expect(gateCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phase 72 hardening — killWhenUnknown short-circuits during Unleash outage
// ---------------------------------------------------------------------------

describe('evaluateAgainst — killWhenUnknown', () => {
  it('returns enabled:false reason:kill-when-unknown for stub clients', async () => {
    const { getFlagClient } = await import('../client.js');
    // Force the stub path by clearing env vars and shutting down singletons.
    const original = {
      url: process.env.UNLEASH_URL_EU,
      token: process.env.UNLEASH_API_TOKEN_EU,
    };
    process.env.UNLEASH_URL_EU = '';
    process.env.UNLEASH_API_TOKEN_EU = '';
    shutdownFlagClients();
    try {
      const stub = getFlagClient('EU');
      const def: FlagDefinition = {
        key: 'killswitch.ai-invoice-parser',
        description: 'test',
        default: true,
        category: 'kill-switch',
        jurisdiction: 'ANY',
        owner: 'test',
        killWhenUnknown: true,
      };
      const result = evaluateAgainst(def, euCtx, stub);
      expect(result).toEqual({ enabled: false, reason: 'kill-when-unknown' });
    } finally {
      if (original.url === undefined) delete process.env.UNLEASH_URL_EU;
      else process.env.UNLEASH_URL_EU = original.url;
      if (original.token === undefined) delete process.env.UNLEASH_API_TOKEN_EU;
      else process.env.UNLEASH_API_TOKEN_EU = original.token;
    }
  });

  it('does NOT short-circuit non-stub clients (regular fakeClient still consults Unleash)', () => {
    const def: FlagDefinition = {
      key: 'killswitch.ai-invoice-parser',
      description: 'test',
      default: true,
      category: 'kill-switch',
      jurisdiction: 'ANY',
      owner: 'test',
      killWhenUnknown: true,
    };
    const result = evaluateAgainst(
      def,
      euCtx,
      fakeClient({ 'killswitch.ai-invoice-parser': true }),
    );
    expect(result).toEqual({ enabled: true, reason: 'unleash' });
  });

  it('flag without killWhenUnknown still receives the code default through a stub', async () => {
    const { getFlagClient } = await import('../client.js');
    const original = {
      url: process.env.UNLEASH_URL_EU,
      token: process.env.UNLEASH_API_TOKEN_EU,
    };
    process.env.UNLEASH_URL_EU = '';
    process.env.UNLEASH_API_TOKEN_EU = '';
    shutdownFlagClients();
    try {
      const stub = getFlagClient('EU');
      const def: FlagDefinition = {
        key: 'module.legal-approval',
        description: 'test',
        default: false,
        category: 'module',
        jurisdiction: 'ANY',
        owner: 'test',
      };
      const result = evaluateAgainst(def, euCtx, stub);
      expect(result).toEqual({ enabled: false, reason: 'unleash' });
    } finally {
      if (original.url === undefined) delete process.env.UNLEASH_URL_EU;
      else process.env.UNLEASH_URL_EU = original.url;
      if (original.token === undefined) delete process.env.UNLEASH_API_TOKEN_EU;
      else process.env.UNLEASH_API_TOKEN_EU = original.token;
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 72 hardening — defensive boolean coercion of SDK return value
// ---------------------------------------------------------------------------

describe('evaluateAgainst — boolean coercion', () => {
  const def: FlagDefinition = {
    key: 'module.legal-approval',
    description: 'test',
    default: false,
    category: 'module',
    jurisdiction: 'ANY',
    owner: 'test',
  };

  it('coerces non-boolean truthy values to false (mirrors strict === true on read side)', () => {
    // Simulate a defective custom strategy returning a non-boolean truthy value.
    const sneakyClient: FlagClient = {
      isEnabled: () => 'yes' as unknown as boolean,
    };
    const result = evaluateAgainst(def, euCtx, sneakyClient);
    expect(result).toEqual({ enabled: false, reason: 'unleash' });
  });

  it('coerces undefined/null returns to false', () => {
    const undefClient: FlagClient = {
      isEnabled: () => undefined as unknown as boolean,
    };
    expect(evaluateAgainst(def, euCtx, undefClient).enabled).toBe(false);
  });

  it('preserves true returns', () => {
    const trueClient: FlagClient = { isEnabled: () => true };
    expect(evaluateAgainst(def, euCtx, trueClient).enabled).toBe(true);
  });
});
