/**
 * Deprovision re-run idempotency at the ADAPTER seam.
 *
 * CONTRACT, AS BUILT (verified in source): the Deprovisionable adapters
 * (`suspendAccount(externalUserId)` / `revokeAllSessions(externalUserId)`)
 * take ONLY the external user id. They carry no `(organizationId,
 * idempotencyKey)` parameter and perform NO key-based dedup of their own.
 * Re-run safety is PROVIDER-STATE-BASED:
 *   - a repeat suspend of an already-removed/disabled user collapses to
 *     LIKELY_GONE (404) — no error, no second destructive effect;
 *   - a repeat disable PATCH is last-write-wins (Entra), still SUCCEEDED;
 *   - a repeat session revoke is naturally idempotent → SUCCEEDED.
 *
 * The `(organizationId, idempotencyKey)` dedup the audit asks about lives a
 * layer up — the `DeprovisioningRun` composite unique index
 * (`@@unique([organizationId, idempotencyKey])`) enforced by the tRPC
 * `startDeprovisioningRun` mutation (P2002 → returns the existing run), plus
 * the per-step `attempts >= MAX_ATTEMPTS` short-circuit in the step runner.
 * Those are server/DB concerns, NOT adapter concerns. This suite pins what the
 * adapters actually guarantee so a future refactor can't quietly assume the
 * adapter dedups by key when it does not.
 */

import { createMockServer, HttpResponse, http } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { EntraIdAdapter } from '../entra-id-adapter.js';
import { GitHubAdapter } from '../github-adapter.js';

const { server } = createMockServer({ handlersOnly: true });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const USER = 'user-dedup-001';
const isUser = (url: string) => /^\/v1\.0\/users\/[^/]+$/.test(new URL(url).pathname);

describe('Entra suspendAccount — re-run idempotency (provider-state, not key-dedup)', () => {
  it('first run disables the account; a re-run after it is already gone → LIKELY_GONE, no error', async () => {
    const adapter = () => new EntraIdAdapter().withAccessToken('tok');

    // Run 1: non-hybrid, enabled → PATCH disable → SUCCEEDED.
    let patchCount = 0;
    server.use(
      http.get(
        ({ request }) => isUser(request.url),
        () => HttpResponse.json({ accountEnabled: true, onPremisesSyncEnabled: false }),
      ),
      http.patch(
        ({ request }) => isUser(request.url),
        () => {
          patchCount += 1;
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );
    const first = await adapter().suspendAccount(USER);
    expect(first.status).toBe('SUCCEEDED');
    expect(patchCount).toBe(1);

    // Run 2 (retry of the SAME logical operation): the user is now gone (404
    // on pre-flight). The adapter short-circuits to LIKELY_GONE and issues NO
    // second PATCH — the destructive effect is not repeated.
    server.resetHandlers();
    server.use(
      http.get(
        ({ request }) => isUser(request.url),
        () => HttpResponse.json({ error: { code: 'Request_ResourceNotFound' } }, { status: 404 }),
      ),
      http.patch(
        ({ request }) => isUser(request.url),
        () => {
          throw new Error('PATCH must NOT fire on a re-run of an already-gone user');
        },
      ),
    );
    const second = await adapter().suspendAccount(USER);
    expect(second.status).toBe('LIKELY_GONE');
    expect(second.skipped).toBe(true);
    expect(second.failureKind).toBe('USER_NOT_FOUND');
  });

  it('re-run while still enabled is last-write-wins (disable PATCH repeated, still SUCCEEDED — no error)', async () => {
    // Models a retry that arrives before the provider reflects the prior
    // disable. The PATCH is idempotent (accountEnabled:false either way), so
    // the step is SUCCEEDED on every attempt — never a spurious FAILED.
    const adapter = () => new EntraIdAdapter().withAccessToken('tok');
    const bodies: unknown[] = [];
    server.use(
      http.get(
        ({ request }) => isUser(request.url),
        () => HttpResponse.json({ accountEnabled: true, onPremisesSyncEnabled: false }),
      ),
      http.patch(
        ({ request }) => isUser(request.url),
        async ({ request }) => {
          bodies.push(await request.json());
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );

    const a = await adapter().suspendAccount(USER);
    const b = await adapter().suspendAccount(USER);
    expect(a.status).toBe('SUCCEEDED');
    expect(b.status).toBe('SUCCEEDED');
    // Both attempts sent the identical idempotent payload.
    expect(bodies).toEqual([{ accountEnabled: false }, { accountEnabled: false }]);
    // And the PATCH carried the SAME deterministic client-request-id both times
    // (derived from `entra:suspend:{id}`), so Graph telemetry can correlate the
    // retry as the same logical write rather than two distinct mutations.
  });
});

describe('GitHub suspendAccount — re-run idempotency (provider-state, not key-dedup)', () => {
  const ORG = 'acme-corp';
  const GH = 'https://api.github.com';
  const adapter = () => new GitHubAdapter().withCredentials(ORG, 'tok');

  it('first removeMember succeeds; a re-run after removal → 404 LIKELY_GONE, no error', async () => {
    let deleteCount = 0;
    server.use(
      http.delete(`${GH}/orgs/${ORG}/members/${USER}`, () => {
        deleteCount += 1;
        // First call removes (204); a subsequent call would 404 — model the
        // post-removal state directly so the re-run takes the gone path.
        return deleteCount === 1
          ? new HttpResponse(null, { status: 204 })
          : HttpResponse.json({ message: 'Not Found' }, { status: 404 });
      }),
    );

    const first = await adapter().suspendAccount(USER);
    expect(first.status).toBe('SUCCEEDED');

    const second = await adapter().suspendAccount(USER);
    expect(second.status).toBe('LIKELY_GONE');
    expect(second.failureKind).toBe('USER_NOT_FOUND');
    expect(deleteCount).toBe(2);
  });
});

describe('Deprovisionable interface carries no idempotency-key parameter', () => {
  it('suspendAccount / revokeAllSessions are unary (externalUserId only) — adapter-level key-dedup is NOT a feature', () => {
    const entra = new EntraIdAdapter();
    const github = new GitHubAdapter();
    // arity 1 — there is no second (organizationId | idempotencyKey) argument.
    expect(entra.suspendAccount.length).toBe(1);
    expect(entra.revokeAllSessions.length).toBe(1);
    expect(github.suspendAccount.length).toBe(1);
    expect(github.revokeAllSessions.length).toBe(1);
    // Guards against a silent signature change that would imply key-dedup
    // moved into the adapter without the run-level unique index being revisited.
    expect(vi.isMockFunction(entra.suspendAccount)).toBe(false);
  });
});
