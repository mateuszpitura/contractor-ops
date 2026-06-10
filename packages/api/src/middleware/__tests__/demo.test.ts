import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/node', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    getCurrentScope: vi.fn(() => ({
      setUser: vi.fn(),
      setTag: vi.fn(),
      setTags: vi.fn(),
      setContext: vi.fn(),
      setExtra: vi.fn(),
      clear: vi.fn(),
    })),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
    setContext: vi.fn(),
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() })),
  withBodyLogging: vi.fn((_o, fn) => fn),
  logIntegrationCall: vi.fn(),
  subscribeOpossumEvents: vi.fn(),
  runWithRequestContext: vi.fn((_c, fn) => fn()),
  getRequestId: vi.fn(() => undefined),
  getTraceparent: vi.fn(() => undefined),
  buildContextFromHeaders: vi.fn(() => ({})),
  getOutboundHeaders: vi.fn(() => ({})),
  generateRequestId: vi.fn(() => 'test-request-id'),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  LOG_BODY_INCLUDE_PREFIXES: [],
  PII_MASK_KEYWORDS: [],
  PII_MASK_PATHS: [],
  createLogger: vi.fn(() => ({
    info: vi.fn(),

    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), distribution: vi.fn(), histogram: vi.fn() },
}));

const env = { DEMO_MODE: false as boolean, DEMO_ORG_IDS: [] as string[] };
vi.mock('@contractor-ops/validators', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, getServerEnv: vi.fn(() => env) };
});

import { t } from '../../init';
import { demoReadOnly } from '../demo';

const guarded = t.procedure.use(demoReadOnly);

const router = t.router({
  read: guarded.query(() => 'ok'),
  write: guarded.mutation(() => 'wrote'),
  allowlisted: guarded.meta({ allowInDemo: true }).mutation(() => 'wrote'),
});
const createCaller = t.createCallerFactory(router);

function ctxFor(orgId: string | null) {
  return {
    headers: new Headers(),
    session: orgId ? { session: { activeOrganizationId: orgId } } : null,
    user: null,
  } as never;
}

beforeEach(() => {
  env.DEMO_MODE = false;
  env.DEMO_ORG_IDS = [];
});

describe('demoReadOnly middleware', () => {
  it('lets queries through in a demo context', async () => {
    env.DEMO_ORG_IDS = ['org_demo'];
    await expect(createCaller(ctxFor('org_demo')).read()).resolves.toBe('ok');
  });

  it('blocks a mutation in a demo context with FORBIDDEN / demoReadOnly', async () => {
    env.DEMO_ORG_IDS = ['org_demo'];
    try {
      await createCaller(ctxFor('org_demo')).write();
      expect.fail('expected demoReadOnly block');
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe('FORBIDDEN');
      expect((e as TRPCError).message).toBe('demoReadOnly');
      expect((e as TRPCError).cause).toMatchObject({ code: 'demoReadOnly' });
    }
  });

  it('blocks every org mutation under global DEMO_MODE', async () => {
    env.DEMO_MODE = true;
    await expect(createCaller(ctxFor('org_real')).write()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'demoReadOnly',
    });
  });

  it('lets a mutation through for a non-demo org', async () => {
    env.DEMO_ORG_IDS = ['org_demo'];
    await expect(createCaller(ctxFor('org_real')).write()).resolves.toBe('wrote');
  });

  it('lets an allowInDemo mutation through in a demo context', async () => {
    env.DEMO_ORG_IDS = ['org_demo'];
    await expect(createCaller(ctxFor('org_demo')).allowlisted()).resolves.toBe('wrote');
  });
});
