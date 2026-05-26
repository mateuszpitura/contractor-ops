/**
 * Vitest global setup — runs once per worker before any test file imports.
 *
 * Required because `@contractor-ops/auth` evaluates `authEnv` at module
 * load time (line `export const authEnv = loadAuthEnv()` in
 * `packages/auth/src/env.ts`). When a test sets env vars in `beforeAll`,
 * the auth module has already been imported with the un-stubbed env →
 * Better Auth boots without a base URL → /api/auth/* returns 404 for
 * unknown routes the bridge cannot satisfy.
 *
 * Setting these here, before vitest loads any test or its imports,
 * guarantees `authEnv` sees the test values on first evaluation.
 */

// @types/node typings flag NODE_ENV as read-only. Cast through Record so the
// global env writes typecheck cleanly inside the test boot script. The cast
// is scoped to this setup file — no production code should reuse it.
const env = process.env as Record<string, string>;

env.NODE_ENV = 'test';
env.APP_URL = 'https://app.example.test';
env.API_URL = 'https://api.example.test';
env.PORT = '4000';
env.HOST = '127.0.0.1';
env.TRUSTED_PROXIES = 'loopback,linklocal,uniquelocal';
env.HEALTH_TIMEOUT_MS = '1000';

// Better Auth — minimum surface for the in-memory boot.
env.BETTER_AUTH_SECRET = env.BETTER_AUTH_SECRET ?? 'test-secret-test-secret';
env.BETTER_AUTH_URL = env.BETTER_AUTH_URL ?? 'https://api.example.test';
env.NEXT_PUBLIC_APP_URL = env.NEXT_PUBLIC_APP_URL ?? 'https://app.example.test';

// Stripe client is constructed eagerly at module load by
// `packages/api/src/services/stripe-client.ts`; without a key it throws
// "Neither apiKey nor config.authenticator provided" before any test
// runs. The value is non-functional — billing tests mock Stripe
// directly — but having any string keeps module load alive.
env.STRIPE_SECRET_KEY = env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder';
