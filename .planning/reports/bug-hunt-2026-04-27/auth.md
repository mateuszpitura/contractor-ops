# Bug-hunt: packages/auth — 2026-04-27

## Summary
- Files reviewed: 10 (5 source + 5 test)
- Findings: **1 CRITICAL, 3 HIGH, 4 MEDIUM, 2 LOW**
- Top 3 risks
  1. **Missing `trustedOrigins` + missing `BETTER_AUTH_SECRET`/`baseURL`** at the server config — relies entirely on Better Auth defaults, which means CSRF / origin-allowlist behaviour is undocumented in this repo and the HMAC secret used to sign session cookies is sourced implicitly from environment.
  2. **OAuth `clientId`/`clientSecret` are forced to `string` even when undefined** — Google/Microsoft providers register at module load with `undefined as string`, silently producing broken (but registered) social-sign-in endpoints in any environment that hasn't set the vars. Failure mode is opaque on first user click.
  3. **Brute-force protection has a TOCTOU race + email enumeration** — `findUnique` after `updateMany` is not atomic and the `Account locked. Try again in N minutes.` error is returned only for valid emails, leaking account existence.

## Findings

### [CRITICAL] OAuth provider configuration registers with `undefined` cast to `string`
**File:** `src/config.ts:27-36`
**What:** Both Google and Microsoft providers are configured unconditionally:
```ts
google: {
  clientId: process.env.GOOGLE_CLIENT_ID as string,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
},
microsoft: { /* same pattern */ },
```
If any of those env vars is missing (very plausible during early/local/preview deploys), `as string` lies to the type system and Better Auth registers OAuth endpoints with `undefined` credentials. The endpoints exist but every login attempt fails server-side, with confusing logs and no startup signal to the operator. Worse, depending on Better Auth's internal handling of empty `client_secret`, this can subtly shift behaviour across versions (OAuth 2.0 RFC 6749 §2.3 allows confidential clients to omit the secret in some flows — relying on a library to bail loudly on `undefined` is fragile).
**Why it's a bug/risk:** Silent misconfiguration of an authentication path is the failure mode CLAUDE.md explicitly forbids ("Avoid silent failures"). The `as string` cast actively hides the misconfiguration from TypeScript, which is the only thing standing between a missing env var and a broken auth flow at this layer. There is also no runtime guard rejecting empty values, so the only place this is caught is the OAuth provider's eventual rejection during the redirect dance.
**Suggested fix:** Make the social providers conditional and validate at module init:
```ts
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
// ...
socialProviders: {
  ...(googleClientId && googleClientSecret
    ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
    : {}),
  ...(microsoftClientId && microsoftClientSecret ? { microsoft: ... } : {}),
},
```
Or feed env through a Zod schema (see CLAUDE.md "Validation & Data Safety" section) and fail fast at boot when the operator opts in to a provider with missing creds.

---

### [HIGH] No explicit `trustedOrigins` or `baseURL` in server config
**File:** `src/config.ts:17-148` (entire `betterAuth(...)` call)
**What:** The Better Auth server config never sets `baseURL` or `trustedOrigins`. The client (`src/client.ts:10`) sets `baseURL: process.env.NEXT_PUBLIC_APP_URL ?? ''`, but the server side has no mirroring constraint.
**Why it's a bug/risk:** Better Auth uses `trustedOrigins` to enforce its CSRF / origin-check on state-changing endpoints. Without an explicit list, the library falls back to defaults (typically the inferred request host or `BETTER_AUTH_URL` from env). Two concrete risks:
- If `BETTER_AUTH_URL` is unset in production, origin checks may be permissive enough that a sub-domain or preview deploy can submit cross-origin auth requests.
- For multi-host deploys (the repo memory mentions Render, multi-region Neon — likely multiple frontends per environment), implicit single-origin defaults are wrong by construction.
This compounds with the fact that `cookies` use `sameSite: 'lax'` which mitigates but does not eliminate cross-origin CSRF on top-level navigations.
**Suggested fix:** Set `baseURL` from a validated env var, and pass `trustedOrigins: [APP_URL, ...optional preview hosts]`. Document the env contract in `.env.example`.

---

### [HIGH] Brute-force lockout has a TOCTOU race and a minor SQLi-non-issue but real correctness bug
**File:** `src/config.ts:75-111` (`after` middleware)
**What:** The atomic increment is correct (`updateMany ... { increment: 1 }`), but the subsequent **read-after-write** to fetch `failedLoginAttempts` and the **second update** to set `lockedUntil` is not atomic. Two concurrent failed sign-ins by the same email racing through this hook can:
- Both observe `failedLoginAttempts < MAX` and skip the lock, even though the post-increment values are 5 and 6.
- One could observe a fresh value where the other already wrote a `lockedUntil`, and overwrite it (effectively only minor — the values are similar).
A more important variant: an attacker spamming requests can interleave between the increment (line 88) and the read (line 95). The window is small but reachable.
**Why it's a bug/risk:** Brute-force protection that races silently is worse than no protection — it gives operators false confidence. OWASP ASVS V3.2.2 / V11.1.4 requires that lockout decisions be atomic.
**Suggested fix:** Combine increment + lock decision in a single SQL statement, e.g. via a raw `UPDATE` with a `CASE WHEN failed_login_attempts + 1 >= 5 THEN now() + interval '15 min' END` for `lockedUntil`. Or use a Prisma transaction with `Serializable` isolation. The ideal is one round-trip, no read-after-write.

---

### [HIGH] Lockout error path leaks account existence (email enumeration)
**File:** `src/config.ts:61-73` (`before` middleware)
**What:** When a sign-in attempt arrives for a locked email, the hook throws `TOO_MANY_REQUESTS` with the message `Account locked. Try again in N minutes.` *before* Better Auth's normal credentials check runs. The `before` lookup is gated on the email actually existing in the DB (`user?.lockedUntil`), so for a non-existent email no lockout error is thrown — the standard "invalid credentials" path runs instead. An attacker can therefore distinguish: "email exists and is locked" vs "email does not exist or is not locked".
Combined with the `MAX_LOGIN_ATTEMPTS = 5` constant: an attacker burning 5 requests against an unknown email gets the standard rejection; against a real email they eventually hit the locked state and the response message changes. They can enumerate by triggering lockout deliberately on a target email then probing.
**Why it's a bug/risk:** Email-enumeration via auth-error timing/message is OWASP A07:2021 (Identification & Authentication Failures). The fact that this codebase deliberately defends against brute-force makes the enumeration vector ironic and worth fixing.
**Suggested fix:** Return a constant-time, message-identical response for both "account locked" and "invalid credentials" — or at minimum, gate the lockout check on `(user?.lockedUntil ?? new Date(0))` and run it for non-existent emails too (sleep-pad to similar latency). Better Auth's own `requireEmailVerification` already returns generic messages on failure; mirror that style.

---

### [MEDIUM] `nextCookies()` plugin is correctly placed last, but no `BETTER_AUTH_SECRET` enforcement is visible
**File:** `src/config.ts:146`
**What:** Comment confirms `nextCookies()` is last (good, per Better Auth docs). However the package never explicitly requires `BETTER_AUTH_SECRET`. If unset, Better Auth derives or warns but in some versions silently uses a non-deterministic key — which would invalidate sessions on every redeploy. There is no startup check.
**Why it's a bug/risk:** A missing/rotating server secret means session cookie HMACs verify intermittently, causing user-visible auth failures or, in older Better Auth versions, a fallback to predictable defaults.
**Suggested fix:** Validate `BETTER_AUTH_SECRET` at module load — fail fast with a clear error in non-development. Add to `.env.example`.

---

### [MEDIUM] `sendInvitationEmail` and `sendMagicLink` silently return in development
**File:** `src/config.ts:130-144`
**What:** Both implementations:
```ts
if (process.env.NODE_ENV === 'development') return;
throw new Error('Production email sending not configured — integrate Resend adapter');
```
The `NODE_ENV === 'development'` short-circuit returns success without sending the email. In dev this is OK, but two issues:
1. There is no log statement showing *what* the URL would have been — making local debugging of magic-link flows annoying (the operator has to dig into Better Auth internals to surface the magic URL).
2. If `NODE_ENV` is anything other than `production` (e.g. `staging`, `test`, `preview`, blank), the code throws — which is the safe direction, but means a test or preview deploy that forgets to set `NODE_ENV=production` will fail with a server-error response rather than a guarded soft-fail.
**Why it's a bug/risk:** This is a "dev shortcut reachable from non-prod" question per the brief. The current pattern fails closed in non-dev (good), but it silently swallows the magic-link URL in dev (bad observability). Per CLAUDE.md "make failures debuggable / no silent failures".
**Suggested fix:** In dev, log the magic link URL via the project's Pino logger (per user memory) instead of returning silently. Also assert that `NODE_ENV === 'production'` is the *only* path that requires Resend, and make `staging` use a real (non-throwing) test mailer.

---

### [MEDIUM] `accountLinking.trustedProviders` includes both Google and Microsoft without email-verification gate
**File:** `src/config.ts:38-43`
**What:**
```ts
account: { accountLinking: { enabled: true, trustedProviders: ['microsoft', 'google'] } },
```
Trusted-provider linking means: if a user signs in via Google with email `alice@example.com` and an existing local account exists with that email, the accounts are auto-linked without a confirmation step. Better Auth treats `trustedProviders` as "we trust this OAuth provider's email-verified claim". Both Google and Microsoft typically deliver verified email — but Microsoft consumer (outlook.com / personal accounts) historically allow self-asserted email in some flows. If an attacker can register a Microsoft consumer account using a victim's email address (where Microsoft does not strictly enforce verification on personal tenants), they can take over the existing local account.
**Why it's a bug/risk:** OWASP A07 / OAuth Security BCP §4.2: account linking based on un-verified provider-supplied email is a known account-takeover vector. The risk is provider-specific and depends on Microsoft's exact verification semantics for the configured tenants.
**Suggested fix:** Verify at link time that the OAuth `email_verified` claim is `true`; if your Microsoft Entra config restricts to a managed tenant only (not consumer accounts), document that constraint. Otherwise drop `microsoft` from `trustedProviders` and require an explicit user-driven link confirmation.

---

### [MEDIUM] No observability on auth failures
**File:** `src/config.ts:58-112` (entire `hooks` block)
**What:** Lockout, increment, and reset all happen silently — no log lines, no metrics, no audit trail. CLAUDE.md "Observability" mandates "include proper logging…", and the user's memory confirms `@contractor-ops/logger` (Pino) is the project standard. A production lockout event is currently invisible.
**Why it's a bug/risk:** Operators cannot see brute-force in progress, cannot alert on it, and cannot forensically reconstruct an account-takeover attempt. SIEM integration is impossible without structured logs at this boundary.
**Suggested fix:** Inject a Pino logger and emit structured events: `{ event: 'auth.signin.locked', email_hash, attempts, lock_until_ms }`. Hash or omit the email if PII is a concern.

---

### [LOW] `authClient` falls back to empty-string `baseURL`
**File:** `src/client.ts:10`
**What:** `baseURL: process.env.NEXT_PUBLIC_APP_URL ?? ''` — empty string means relative URLs, which usually works but masks misconfiguration. A dev who misnames the env var sees no error.
**Why it's a bug/risk:** The Next.js public env vars are inlined at build time; once a build is shipped without the var set, the bundle is permanently wrong. A loud failure at build time is preferable.
**Suggested fix:** Throw at module init if `NEXT_PUBLIC_APP_URL` is missing in non-development builds, or document that empty-string is the intentional same-origin default.

---

### [LOW] `parseMemberRole` accepts whitespace-trimmed input from arbitrary callers
**File:** `src/role-normalization.ts:20-29`
**What:** The function trims its input before checking the allow-list. This is mildly defensive but means callers can pass `"  admin  "` and have it accepted as `"admin"`. Combined with downstream code that may store this value back to the DB as the *trimmed* form, any caller sending whitespace-padded role names will see unexpected mutation behaviour.
**Why it's a bug/risk:** Authorization predicates should accept exact matches only; silent normalization of an authorization-relevant string is a code smell. The allow-list itself prevents privilege escalation, so this is LOW, but it makes audit logs less precise.
**Suggested fix:** Drop the `trim()` — fail closed on whitespace. If trimming is needed, do it once at the boundary (e.g. when parsing API input) and never inside the role parser.

---

## Files reviewed
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/auth/src/config.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/auth/src/client.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/auth/src/permissions.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/auth/src/roles.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/auth/src/role-normalization.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/auth/src/index.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/auth/src/__tests__/config.test.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/auth/src/__tests__/permissions.test.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/auth/src/__tests__/roles.test.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/auth/src/__tests__/role-normalization.test.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/auth/src/__tests__/permissions-override-blocking-task.test.ts`

## Notes on what is genuinely clean
- **Permissions / roles model** (`permissions.ts`, `roles.ts`, `role-normalization.ts`): The role table is well-typed, the `accessControlStatement` is tested for completeness, and the `override_blocking_task` OWNER-only invariant has a dedicated regression test. Multi-tenant boundary at the role layer looks correct: `platform_operator` is intentionally separate and explicitly does not inherit any tenant resource — the comment on lines 14-17 of `roles.ts` shows the author was thinking about this.
- **Test coverage of permission edges** is unusually good — the workflow override-blocking-task table test (`permissions-override-blocking-task.test.ts`) is a model regression test.
- **`session.expiresIn = 24h` + `updateAge = 1h`** is a reasonable default. Cookie defaults (`sameSite: 'lax'`, `secure: production`, `path: '/'`) follow Better Auth recommendations.
- **No console.log calls anywhere** — adheres to the project's Pino-only rule (though see MEDIUM #4 about *adding* logs at security boundaries).
- **No `any` casts in source** — confirmed (the `as string` env casts in `config.ts` are the only type-launderings).
