# Security & Vulnerability Audit

**Auditor:** Claude (Opus 4.7, 1M context)
**Date:** 2026-05-03
**Scope:** Findings NOT already tracked in `SECURITY-AUDIT.md` (2026-04-11). Read-only review of `apps/web`, `apps/public-api`, `apps/landing`, `packages/api`, `packages/auth`, `packages/integrations`, `packages/db`, `packages/validators`, `packages/secrets`.

## Executive summary

| Severity | Count |
|----------|-------|
| **CRITICAL** | 4 |
| **HIGH** | 7 |
| **MEDIUM** | 7 |
| **LOW** | 4 |
| **Total** | **22** |

Headline issues:
- **Cross-tenant document exfiltration via portal** (`portal.submitInvoice` accepts attacker-supplied `storageKey`).
- **Jira & Linear webhook signature bypass** (secret read from request header instead of server-side config).
- **InPost webhook signature bypass** in production (unsigned payloads accepted via shipment-id fallback).
- **Platform-wide admin layout grants any org owner access to `/admin/*`**.
- **OAuth callback CSRF** — state binds to attacker's `orgId/userId`, not the logged-in browser session, enabling cross-account credential capture for every adapter (Slack, Jira, Linear, Notion, Google Workspace, Outlook, Confluence, Clockify, etc.).
- **Cross-org user ban via `user.deactivate`** — `banUser` is called with input `userId` without checking org membership.
- **Magic-link host-header injection** — portal magic-link emails use `Origin`/`Host`/`X-Forwarded-Host` to derive base URL, allowing phishing redirection of arbitrary recipients.

---

## Findings

### F-SEC-01: Cross-tenant document exfiltration via portal `submitInvoice`

- **Severity:** CRITICAL
- **CWE:** CWE-639 (IDOR), CWE-22 (Path Traversal in Storage Key)
- **Location:** `packages/api/src/routers/portal/portal.ts:719-817`, `packages/api/src/routers/portal/portal-doc-mapper.ts:34-45`, `packages/api/src/routers/portal/portal.ts:511-556`
- **Attack scenario:**
  1. An authenticated portal contractor calls `portal.submitInvoice` with a forged payload: `documentId: <random UUID>`, `storageKey: "orgs/<victim-org-id>/documents/<known-doc-id>.pdf"` (any other tenant's R2 path the attacker has guessed or learned).
  2. The handler creates a `Document` row with the supplied `storageKey` (no `startsWith("orgs/${ctx.organizationId}/")` check) and links it to a new portal-submitted `Invoice`.
  3. The contractor calls `portal.getInvoice` for the new invoice; the response contains a presigned R2 download URL signed for the victim org's path (`mapPortalDocLink` → `createRegionalPresignedDownloadUrl(f.document.storageKey)`), valid for 15 minutes.
  4. The contractor downloads any other tenant's document.
- **Fix:** In `submitInvoice` (and `getUploadUrl`/`uploadNewVersion`/anywhere a client-supplied storage key is accepted), reject keys that do not start with the canonical tenant prefix produced by `generateStorageKey(ctx.organizationId, ...)`. Better: stop accepting `storageKey` from the client at all — derive it server-side from `documentId` (a server-generated UUID returned from `getUploadUrl`) and look it up in a short-lived "pending upload" table that records `(documentId, organizationId, expectedKey, expiresAt)`.
- **Effort:** M

### F-SEC-02: Jira webhook signature bypass — secret read from attacker-controlled header

- **Severity:** CRITICAL
- **CWE:** CWE-287 (Improper Authentication), CWE-345 (Insufficient Verification of Data Authenticity)
- **Location:** `packages/integrations/src/adapters/jira-adapter.ts:178-229` (read of `headers['x-webhook-secret']`); `apps/web/src/app/api/webhooks/[provider]/route.ts:45-51` (passes raw inbound headers verbatim).
- **Attack scenario:**
  - The route handler computes `headers = Object.fromEntries(request.headers.entries())` from the **inbound** request, then calls `adapter.verifyWebhookSignature(rawBody, headers)`.
  - The Jira adapter pulls the HMAC secret from `headers['x-webhook-secret']` (and falls through with `valid: true` if the header is missing!). An attacker can `curl -H 'x-webhook-secret: anything' -H 'x-hub-signature: sha256=<hmac of body using "anything">'` and pass verification.
  - Worse: if the attacker omits `x-webhook-secret` entirely, the adapter returns `{ valid: true }` (line 188-197) and the request is accepted with **no signature verification at all**.
  - Result: arbitrary spoofed Jira webhook payloads are persisted to `WebhookDelivery` and dispatched to `processJiraWebhook` (which mutates linked workflow tasks, worklogs, transitions).
- **Fix:** Resolve the secret server-side from `IntegrationConnection.configJson.webhookSecret` for the resolved `organizationId`. Stop reading `x-webhook-secret` from inbound headers. If the secret is null or the request lacks a signature, reject with 401 (no fall-through `valid: true`). Apply the same change to `linear-adapter.ts:183-228` (identical bug).
- **Effort:** M

### F-SEC-03: Linear webhook signature bypass — secret read from attacker-controlled header

- **Severity:** CRITICAL
- **CWE:** CWE-287, CWE-345
- **Location:** `packages/integrations/src/adapters/linear-adapter.ts:183-228`
- **Attack scenario:** Identical to F-SEC-02. The Linear adapter accepts the HMAC secret from `headers['x-webhook-secret']` (or `LINEAR_WEBHOOK_SECRET` env var). An attacker who can reach `/api/webhooks/linear` directly supplies `x-webhook-secret: foo` and `linear-signature: <hmac(body, "foo")>` and the handler treats the payload as authentic, queueing `processLinearWebhook` execution against the resolved org.
- **Fix:** Same as F-SEC-02 — resolve secret server-side from the integration connection, never trust `x-webhook-secret` from the request.
- **Effort:** M

### F-SEC-04: Admin layout grants any org owner platform-wide admin access

- **Severity:** CRITICAL
- **CWE:** CWE-285 (Improper Authorization), CWE-269 (Improper Privilege Management)
- **Location:** `apps/web/src/app/admin/layout.tsx:35-48`
- **Attack scenario:**
  - The admin shell gates access with `const isSuperAdmin = membership?.role === 'owner';` — i.e. **anyone whose Better Auth Member.role for the active org is `owner` reaches `/admin/*`**. Every user automatically becomes `owner` of any org they create (`organization.create` in Better Auth).
  - An attacker signs up, creates an org, switches to it, and navigates to `/admin/feature-flags/classification-engine` to view the global Unleash flag state for the platform's classification kill-switch and the disclaimer signoff registry (`apps/web/src/app/admin/feature-flags/classification-engine/page.tsx:36-60`). The page performs **no further authorization** beyond a session/orgId presence check.
  - Although `adminBoeRateRouter` mutations require `admin:boe-rate` permission (only `platform_operator` role grants it), the BoE-rate UI page and the feature-flag status page leak operator-only data and cross-tenant signoff metadata.
- **Fix:** Replace `membership.role === 'owner'` with `membership.role === 'platform_operator'` (the role actually defined for cross-tenant operators in `packages/auth/src/roles.ts:130-132`). Additionally, gate `/admin/*` to the dedicated platform-operator org only (compare `session.session.activeOrganizationId === PLATFORM_OPERATOR_ORG_ID`). Add a per-page `requirePermission({ 'admin:boe-rate': ['read'] })` server-side check so the layout is not the sole gate.
- **Effort:** S

### F-SEC-05: OAuth callback does not bind state to the logged-in browser session — cross-account credential capture

- **Severity:** HIGH
- **CWE:** CWE-352 (CSRF), CWE-287 (Improper Auth in OAuth flow)
- **Location:** `packages/integrations/src/services/oauth-state.ts:29-91` (state contains only `provider:orgId:userId:timestamp`); `apps/web/src/app/api/oauth/[provider]/callback/route.ts:25-116` (callback never compares state.userId to the current session).
- **Attack scenario:**
  1. Attacker logs into their own contractor-ops org A and starts the Google Workspace OAuth flow. `integration.getOAuthStartUrl` returns `https://accounts.google.com/...&state=<HMAC-signed payload binding orgId=A, userId=attacker>`.
  2. Attacker hands that authorize URL to Victim (phishing email / malicious link).
  3. Victim, already logged into Google with their own corporate Google Workspace account, clicks the link, sees Google's consent screen for the contractor-ops Google client, and approves.
  4. Google redirects to `https://app.contractor-ops.com/api/oauth/google-workspace/callback?code=<victim-code>&state=<attacker-state>`.
  5. The callback verifies the state HMAC successfully (it was signed correctly by the attacker's flow) and exchanges Victim's `code` for Victim's tokens, then writes an `IntegrationConnection` row for `state.orgId` (Attacker's org A).
  6. Attacker now holds Victim's Google Workspace OAuth tokens inside Attacker's own org and can read Victim's directory, calendars, etc.
- **Fix:** Bind state to a single-use cookie. On `getOAuthStartUrl`, generate `nonce = randomBytes(32).base64url`, set `__Host-oauth_state=<sha256(nonce)>` cookie (httpOnly, secure, sameSite=lax, 10-min Max-Age, path=/api/oauth) and include `nonce` (or its hash) in the signed state. In the callback, require the cookie to be present, hash it, and `timingSafeEqual` it against the value embedded in state. Clear the cookie on use. This anchors the OAuth round-trip to the browser that initiated it.
- **Effort:** M

### F-SEC-06: InPost webhook signature bypass via shipment-id fallback in production

- **Severity:** HIGH
- **CWE:** CWE-287, CWE-345
- **Location:** `apps/web/src/app/api/webhooks/inpost/route.ts:35-126` (specifically the `?? (await matchOrgByShipmentPayload(rawBody))` chain on line 103).
- **Attack scenario:**
  - When the InPost HMAC signature does not match any org's `webhookSecret`, the handler falls through to `matchOrgByShipmentPayload`, which trusts the request body's `shipment_id`/`tracking_number` fields to identify the org. There is **no `NODE_ENV === 'production'` guard** despite `SECURITY-AUDIT.md` § 3 claiming "production rejects unsigned" (the guard exists nowhere in this file).
  - Attacker discovers a single shipment external/tracking id (often returned in customer-facing tracking emails or printed on labels) and POSTs a forged body with that id; the handler invokes `handleInPostWebhook` against the matched org, allowing fake status transitions (e.g. "DELIVERED").
- **Fix:** Wrap the fallback in `if (process.env.NODE_ENV !== 'production')` or remove it entirely. If a real signed-secret-rotation use case exists, require an explicit per-org `allowUnsignedWebhooks: true` flag on `CourierConfig.configJson` and never enable it by default.
- **Effort:** S

### F-SEC-07: `user.deactivate` / `user.reactivate` ban users globally without tenant membership check

- **Severity:** HIGH
- **CWE:** CWE-639 (IDOR), CWE-863 (Incorrect Authorization)
- **Location:** `packages/api/src/routers/core/user.ts:197-213` (`deactivate`), `:219-229` (`reactivate`).
- **Attack scenario:**
  - `deactivate` calls `await guardLastAdmin(ctx.db, ctx.organizationId, input.userId)`, but `guardLastAdmin` (`:18-42`) returns silently when `targetMember` is `null` (i.e. the supplied user is not even a member of the caller's org). It then unconditionally invokes `authApi.banUser({ body: { userId: input.userId } })`, which Better Auth's admin plugin applies **globally** (it bans the User row, not the membership).
  - An admin in any org can pass any other user's id (e.g. enumerated from public profile pages or known emails resolved server-side) and lock them out of every org they belong to. Same primitive in `reactivate` lets an attacker un-ban someone.
- **Fix:** Before calling `banUser`, `await ctx.db.member.findFirstOrThrow({ where: { organizationId: ctx.organizationId, userId: input.userId } })` and throw `NOT_FOUND` if the target is not a member of the caller's org. Replace the global `banUser` call with a per-membership soft-disable (e.g. `member.update({ ..., disabledAt })` plus a session check that rejects sessions whose `activeOrganizationId` membership is disabled). If global ban is intentional, make it `platform_operator`-only.
- **Effort:** M

### F-SEC-08: Magic-link host-header injection (portal magic-link emails)

- **Severity:** HIGH
- **CWE:** CWE-601 (Open Redirect), CWE-20 (Improper Input Validation), CWE-1021 (Improper Restriction of Frame UI)
- **Location:** `packages/api/src/routers/portal/portal.ts:73-85` (`deriveBaseUrl`), `:148-161` (`requestMagicLink` calls `sendPortalMagicLink({ baseUrl })`); `packages/api/src/services/portal-magic-link.ts:113-131` (`sendPortalMagicLink` interpolates `baseUrl` directly into the link).
- **Attack scenario:**
  1. Attacker discovers a target contractor's email (or guesses common ones).
  2. Attacker sends `POST /api/trpc/portal/portal.requestMagicLink` with header `Origin: https://evil.attacker.com` and body `{ email: "victim@target.com" }`.
  3. `deriveBaseUrl` returns `https://evil.attacker.com`. The magic link delivered to the victim points to `https://evil.attacker.com/portal/login/verify?token=<real-token>`.
  4. Victim clicks; attacker's server captures `?token=`, then immediately calls `verifyMagicLink` to consume the single-use token and create a portal session for the victim's contractor record.
- **Fix:** Stop trusting `Origin`/`X-Forwarded-Host`/`Host` for outbound URL construction. Use `getServerEnv().NEXT_PUBLIC_APP_URL` (or a per-org `portalBaseUrl` stored on `Organization`). If subdomain-per-org portals must build dynamic URLs, validate the derived host against a server-side allowlist (e.g. `*.${PORTAL_BASE_DOMAIN}` after stripping ports) before substituting.
- **Effort:** S

### F-SEC-09: `portal/set-session` accepts arbitrary cookie value with no proof of origin

- **Severity:** HIGH
- **CWE:** CWE-384 (Session Fixation), CWE-352 (CSRF), CWE-602 (Client-Side Enforcement of Server-Side Security)
- **Location:** `apps/web/src/app/api/portal/set-session/route.ts:32-56`
- **Attack scenario:**
  - This Next.js route accepts any `{ token, expiresAt }` body and writes `portal_session=<token>` httpOnly cookie unconditionally. There is no signature, no CSRF token, no proof the caller obtained the token from `verifyMagicLink`. Although the downstream `validatePortalSession` requires the token to exist in DB (so the attacker can't simply pick any value), the design enables session fixation: an attacker who obtains a valid raw token via any side-channel (XSS on the same origin, server log capture, error-page leak) can plant it on a victim's browser by silently submitting a CSRF form to `/api/portal/set-session`.
  - Compounding: there's no `sameSite` cookie attribute on the **endpoint** itself (only the cookie it sets), so cross-origin POSTs are accepted (no CSRF token guard), and `samesite=strict` on the set cookie does not protect against a same-site (subdomain) attacker.
- **Fix:** Eliminate the round-trip: have `verifyMagicLink` and `selectOrg` set the `portal_session` cookie directly via `Set-Cookie` in their tRPC response (Next.js mutations support response header mutation). If the round-trip stays, add a CSRF token: `verifyMagicLink` returns `{ rawToken, csrfNonce }`, persist `csrfNonce` server-side bound to the session, require it as a header on `set-session`, and discard after use.
- **Effort:** M

### F-SEC-10: `requestedChanges` JSON returned to portal client contains `bankAccountEncrypted` ciphertext

- **Severity:** HIGH
- **CWE:** CWE-200 (Information Exposure), CWE-922 (Insecure Storage of Sensitive Information)
- **Location:** `packages/api/src/routers/portal/portal.ts:916-927` (selects `requestedChanges` JSON wholesale); `:1043-1067` (writes `bankAccountEncrypted` into that JSON).
- **Attack scenario:**
  - When a contractor submits a financial change request including a new bank account (`updateFinancialInfo`), `requestedChanges.bankAccountEncrypted = encryptBankAccount(...)` is stored in the JSON column.
  - On every subsequent `getProfile` call the entire `requestedChanges` JSON is returned to the contractor, exposing the AES-GCM ciphertext of their own bank account number. While encrypted, this reveals (1) the IV, auth tag, and ciphertext — useful for offline analysis if the AES key is ever leaked, (2) the encryption format and key-rotation history, (3) the implicit confirmation that "this is the bank account currently pending approval", which simplifies social-engineering reset flows.
  - More importantly, this signals a missing field-mask discipline: the same `requestedChanges` blob is later surfaced to admins for approval, where the cleartext `bankName`/`swiftBic`/`taxId` are correct to expose, but `bankAccountEncrypted` should never leave the server.
- **Fix:** When selecting `pendingChangeRequest`, strip `bankAccountEncrypted` from the response: `select: { id, createdAt, requestedChanges: true }` then post-process: `delete (req.requestedChanges as Record<string, unknown>).bankAccountEncrypted`. Replace it with `bankAccountMasked` only.
- **Effort:** S

### F-SEC-11: Cron handlers use `Buffer.from('')` length check that silently bypasses when `CRON_SECRET` is unset

- **Severity:** MEDIUM (HIGH if env validation is bypassed)
- **CWE:** CWE-287, CWE-1188 (Insecure Default Initialization)
- **Location:** `apps/web/src/app/api/cron/data-purge/route.ts:76-83`, `apps/web/src/app/api/cron/job-health/route.ts:34-42`. Same pattern lives in `packages/api/src/middleware/cron-trpc.ts:10-24`.
- **Attack scenario:**
  - These handlers compute `expected = "Bearer " + (process.env.CRON_SECRET ?? '')`. If the env var is absent or empty (e.g. forgotten on a fresh deployment, or temporarily blanked during incident response), `expected = "Bearer "` (length 7). The auth check is `authHeader.length === expected.length && timingSafeEqual(...)`. An attacker sending `Authorization: Bearer ` (with the trailing space) satisfies both branches and triggers the cron job.
  - `data-purge` is the worst case: a successful unauthorized invocation **permanently deletes** all soft-deleted Documents/Invoices/Contracts/Contractors and the associated R2 objects. Although `getServerEnv()` validates `CRON_SECRET` at module load, these routes use `process.env.CRON_SECRET` directly and bypass the validator.
- **Fix:** Either route the comparison through `getServerEnv().CRON_SECRET` (which throws on empty string thanks to `z.string().min(16)`), or add `if (!cronSecret || cronSecret.length < 16) return NextResponse.json({error:'Server misconfigured'}, {status:500})` before the comparison. Apply identically to `cron-trpc.ts:10-24`.
- **Effort:** S

### F-SEC-12: Banned/suspended organizations still authenticate via API key

- **Severity:** MEDIUM
- **CWE:** CWE-285 (Improper Authorization)
- **Location:** `packages/api/src/middleware/api-key-auth.ts:25-66`; `packages/api/src/services/api-key-service.ts:116-138` (selects `organization.status` but never checks it).
- **Attack scenario:** When an org is suspended (e.g. for non-payment, abuse, fraud — `Organization.status` enum), its API keys remain fully active. The middleware happily establishes tenant context and downstream queries succeed. A revoked/suspended customer can continue exfiltrating data through the public API as long as their key is not individually revoked.
- **Fix:** In `api-key-auth.ts`, after `resolveApiKey`, add `if (keyRecord.organization.status !== 'ACTIVE') throw new TRPCError({ code: 'FORBIDDEN', message: 'ORG_SUSPENDED' });`. Mirror this in `tenantMiddleware` for session-based auth.
- **Effort:** S

### F-SEC-13: `requireEmailVerification: true` with no `sendVerificationEmail` handler

- **Severity:** MEDIUM (Functional security failure)
- **CWE:** CWE-754 (Improper Check for Unusual Conditions)
- **Location:** `packages/auth/src/config.ts:65-68` (sets `requireEmailVerification: true`); no `emailAndPassword.sendVerificationEmail` handler exists, and `magicLink.sendMagicLink` `throw`s in production (`:243-247`); `sendInvitationEmail` also throws (`:218-225`).
- **Attack scenario:** Any user signing up via email/password in production cannot verify their email — the verification email is never sent (Better Auth has no handler wired). The resulting account is permanently in unverified state, but Better Auth still returns a session in some configurations or, conversely, locks legitimate users out. Combined with the lack of a `sendResetPassword` handler, **password reset is also broken**. The auth surface is effectively unsigned-up-able and unrecoverable in prod.
- **Fix:** Implement `emailAndPassword.sendVerificationEmail`, `emailAndPassword.sendResetPassword`, `magicLink.sendMagicLink`, and `organization.sendInvitationEmail` using `sendAppEmail` (Resend) — all four are silently broken in non-development environments today. Fail the build / boot if any handler returns a "not configured" error.
- **Effort:** M

### F-SEC-14: `updateRole` passes `userId` where `memberId` is expected; `updateUserRoleSchema` shape mismatch

- **Severity:** MEDIUM (silent privilege misassignment risk)
- **CWE:** CWE-863 (Incorrect Authorization)
- **Location:** `packages/api/src/routers/core/user.ts:176-190` (passes `memberId: input.userId` to `authApi.updateMemberRole`); `packages/validators/src/user.ts:19-22` (schema field is `userId`, not `memberId`).
- **Attack scenario:** Better Auth's `updateMemberRole` resolves by `memberId` (the `Member` table primary key), not user id. The contractor-ops mutation supplies a `userId` value. Depending on Better Auth's version and adapter behaviour, this may (a) silently no-op (membership not found by id), (b) update the wrong membership if a Member row has an id that collides with a User id, or (c) raise an opaque adapter error. Combined with the `member:update` permission gate, an admin clicking "promote to owner" may believe they granted the role but the change never persists; conversely, with a different shape mismatch, a role update could land on an unintended membership row.
- **Fix:** Either (i) change the validator to `memberId: z.string()` and update the UI to send the Member.id, or (ii) translate inside the mutation: `const member = await ctx.db.member.findFirstOrThrow({ where: { organizationId: ctx.organizationId, userId: input.userId } }); await authApi.updateMemberRole({ body: { memberId: member.id, role: input.role, organizationId: ctx.organizationId }})`. Add a regression test that asserts the role actually changes.
- **Effort:** S

### F-SEC-15: Public-API `getDownloadUrl` does not block PENDING-virus-scan documents

- **Severity:** MEDIUM
- **CWE:** CWE-434 (Unrestricted File Upload), CWE-285 (Authorization Bypass)
- **Location:** `packages/api/src/routers/public-api/document.ts:73-101` (only blocks `INFECTED`); `packages/api/src/routers/core/document.ts:242-270` has the same omission.
- **Attack scenario:** A user uploads a malicious file via `requestUpload`/`uploadNewVersion`. The file enters R2 with `virusScanStatus: 'PENDING'`. Before the async ClamAV scan completes, the same user (or anyone with `document:read`) calls `getDownloadUrl` and receives a 15-minute presigned URL. They can race-distribute the link to any number of downloaders before the scan flips the status to `INFECTED`.
- **Fix:** Reject downloads for both `INFECTED` and `PENDING`: `if (doc.virusScanStatus !== 'CLEAN') throw new TRPCError({code:'FORBIDDEN', message: doc.virusScanStatus === 'PENDING' ? 'SCAN_PENDING' : 'INFECTED'})`. Optionally allow the uploader (`uploadedByUserId === ctx.user.id`) to download their own pending file but never others.
- **Effort:** S

### F-SEC-16: `taxId` returned to all org members via global search results

- **Severity:** MEDIUM
- **CWE:** CWE-200 (Information Exposure), CWE-359 (Privacy Violation)
- **Location:** `packages/api/src/routers/core/search.ts:62-69` (selects `"taxId" as subtitle`).
- **Attack scenario:** Any user with `tenantProcedure` access (which is everyone in an org regardless of role — `legal_compliance_viewer`, `external_accountant`, `readonly` all qualify) can use the global command-palette search to return up to 5 contractors per query with their tax IDs in the subtitle field. Tax IDs (NIP, REGON, USt-IdNr, NINO, NIE, etc.) are PII / sensitive financial identifiers; many roles do not need them. The search router has no `requirePermission` middleware.
- **Fix:** Add `.use(requirePermission({ contractor: ['read'] }))` and replace `taxId` with `displayName`/`legalName` in the subtitle (the result already includes `name`; subtitle should be a non-sensitive disambiguator like country + city). For roles needing taxId, a dedicated contractor-detail page already exists.
- **Effort:** S

### F-SEC-17: Rate-limit identifier `x-forwarded-for` is attacker-spoofable on misconfigured deployments

- **Severity:** MEDIUM (HIGH on reverse-proxy misconfig)
- **CWE:** CWE-290 (Authentication Bypass by Spoofing)
- **Location:** `apps/web/src/middleware.ts:308-311` (and identical pattern in `packages/api/src/routers/portal/portal.ts:189`, `:270` for IP audit fields).
- **Attack scenario:** The middleware reads `request.headers.get('x-forwarded-for')?.split(',')[0]` and uses that as the rate-limit key. On Vercel/Render this header is set by the platform proxy, but Next.js does not strip incoming `X-Forwarded-For` headers — if any deployment lands behind a proxy that **appends** rather than overwrites, or runs on bare Node/Render without a strict proxy chain, an attacker can include `X-Forwarded-For: <random>` on every request to bypass the per-IP cap entirely (each request appears as a new client).
- **Fix:** Use Next.js 15's `request.headers.get('x-real-ip')` only when the platform sets it, and trust only the **rightmost** entry in `X-Forwarded-For` (the address closest to the trusted proxy). Better: pin a fixed-length list of trusted proxy IPs in env (`TRUSTED_PROXIES`) and walk the XFF chain right-to-left until you exit the trusted set. Document the platform's proxy header behaviour in `.env.example`.
- **Effort:** M

### F-SEC-18: `requestUpload` accepts client `mimeType` that is signed into the presigned URL but never validated against actual bytes

- **Severity:** MEDIUM
- **CWE:** CWE-434, CWE-79 (Stored XSS via mismatched Content-Type)
- **Location:** `packages/api/src/routers/core/document.ts:135-189` (signs `input.mimeType` into the PUT URL); `packages/api/src/services/r2.ts:127-139` (`createPresignedUploadUrl` signs `ContentType`).
- **Attack scenario:** S3/R2 enforces the signed `ContentType` on PUT, so the bytes can be anything the client sends as long as the header matches. A user requests a presigned URL with `mimeType: "application/pdf"`, then uploads HTML/JS bytes with `Content-Type: application/pdf`. R2 stores the object with `application/pdf` metadata. Although the download path uses `ResponseContentDisposition: attachment` (which forces a download dialog), any future code that signs without `ResponseContentDisposition` (e.g. inline image preview, in-app PDF viewer that proxies the file, CDN that strips the override) renders the attacker bytes with the wrong MIME and bypasses CSP.
- **Fix:** Add server-side MIME sniffing on `confirmUpload`: download a small head of the object, run it through `file-type` (npm), and reject if the detected MIME does not match `doc.mimeType`. Strip the user-supplied mime entirely and force `application/octet-stream` server-side until verified. Always set `ResponseContentDisposition: attachment` and a `Content-Security-Policy: sandbox` header on serving paths.
- **Effort:** M

### F-SEC-19: Uploaded file size declared by client is overwritten with R2's `ContentLength` but never bounded

- **Severity:** LOW
- **CWE:** CWE-770 (Allocation of Resources Without Limits)
- **Location:** `packages/api/src/routers/core/document.ts:195-236` (`confirmUpload` updates `fileSizeBytes` from `headResponse.ContentLength`).
- **Attack scenario:** `requestUpload` accepts `input.fileSizeBytes` from the client but the presigned PUT URL does not include a `Content-Length` constraint, so the user can upload a multi-GB file regardless of the declared size. `confirmUpload` then trusts R2's ContentLength. Without a per-org storage cap, a contractor can fill up the bucket (incurring cost) or push the org over a Stripe seat-cost-related quota.
- **Fix:** Enforce a per-content-type max size constant and pass it as `ContentLength` to `PutObjectCommand` so the presigned URL rejects oversize PUTs. Alternatively, after `headObject`, reject if `ContentLength > MAX_DOCUMENT_BYTES` (e.g. 100 MB) and delete the object.
- **Effort:** S

### F-SEC-20: tRPC `errorFormatter` not configured — Zod issues and constraint names leak in error messages

- **Severity:** LOW
- **CWE:** CWE-209 (Information Exposure Through Error Message)
- **Location:** `packages/api/src/init.ts:6-8` (no `errorFormatter`), `apps/web/src/app/api/trpc/[trpc]/route.ts:18-30` (no `responseMeta` / `errorFormatter` override).
- **Attack scenario:** Default tRPC `defaultFormatter` includes the raw `message`, `code`, and Zod `issues` in production. A few procedures throw raw error messages (e.g. `packages/api/src/routers/core/import.ts:203,253,307` returns `err.message` from CSV/XLSX parser; `packages/api/src/routers/core/einvoice.ts:795,807` writes raw error text into `lastErrorJson`). When Prisma raises a unique-constraint violation, `err.message` discloses the constraint name and offending row, which leaks DB schema. A targeted attacker can probe protected fields by triggering errors and reading the structured response.
- **Fix:** Add a global `errorFormatter` to `initTRPC` that whitelists fields: in production return `{ code, httpStatus, path }` only and discard `message`/`stack`/`zodError` for `INTERNAL_SERVER_ERROR`. Wrap mutations that surface raw error text (`import.ts`, `einvoice.ts`) in `try/catch` that maps known error subclasses to friendly codes and logs the raw error via `createLogger`.
- **Effort:** S

### F-SEC-21: OAuth state has no replay protection within the 10-minute window

- **Severity:** LOW
- **CWE:** CWE-294 (Authentication Bypass by Capture-replay)
- **Location:** `packages/integrations/src/services/oauth-state.ts:29-91`.
- **Attack scenario:** Authorization codes are one-time at the IdP, but the `state` parameter is verified solely by HMAC + provider match + 10-min freshness. There is no nonce/jti or single-use enforcement. Combined with F-SEC-05, an attacker who captures one valid `state` (e.g. via referrer leakage on the IdP's hosted-pages, or via browser history if the user shares a screenshot) can re-use that state with a different `code` from a different victim within the freshness window to associate Victim B's account with the credentials baked into the state.
- **Fix:** Persist a `OAuthStateChallenge { stateHash, organizationId, userId, expiresAt, consumedAt }` row when generating state and atomic `updateMany({ where: stateHash, consumedAt: null }, { consumedAt: now })` on callback before exchanging the code. Discard the row after 10 minutes.
- **Effort:** M

### F-SEC-22: Email enumeration via `b2c` create-org / signup error variance

- **Severity:** LOW
- **CWE:** CWE-203 (Observable Discrepancy), CWE-204 (Response Discrepancy)
- **Location:** `packages/auth/src/config.ts:99-188` (sign-in path is hardened; sign-up path is not). `organization.create` is `publicProcedure`.
- **Attack scenario:** While the sign-in `before`/`after` hooks scrupulously return generic `Invalid email or password` for both unknown-email and locked accounts, the sign-up endpoint (Better Auth default) returns distinct messages for "email already in use" vs. "valid signup". Combined with no per-IP rate limit on `signUp` beyond the `/api/auth` 10/min bucket, this enables email enumeration at ~10 emails/min/IP — sufficient to enumerate a small org. `organization.create` similarly distinguishes "slug taken" vs. "slug available", letting an attacker probe org slugs.
- **Fix:** Use Better Auth's `disableSignUp: false` together with a custom `before` hook on `/sign-up/email` that returns a generic 200 "If your email is new, check your inbox" while internally short-circuiting on duplicates (and silently sending the dupe a "you already have an account" email). For org slug, return `{ available: false }` only after a generic create attempt.
- **Effort:** M

---

## Summary table by area

| Area | Findings |
|------|----------|
| Multi-tenant isolation | F-SEC-01 (portal IDOR via storageKey), F-SEC-07 (cross-org ban) |
| Webhook authentication | F-SEC-02 (Jira), F-SEC-03 (Linear), F-SEC-06 (InPost) |
| Authorization | F-SEC-04 (admin layout), F-SEC-12 (suspended org), F-SEC-14 (role mismatch), F-SEC-16 (search PII) |
| OAuth / SSO | F-SEC-05 (state ↔ session not bound), F-SEC-21 (state replay) |
| Cookies / sessions | F-SEC-09 (set-session fixation) |
| PII leakage | F-SEC-10 (bankAccountEncrypted in JSON), F-SEC-16 (taxId in search), F-SEC-22 (signup enumeration) |
| Cron / scheduler | F-SEC-11 (CRON_SECRET length-bypass) |
| File upload / storage | F-SEC-15 (PENDING scan downloadable), F-SEC-18 (mimeType signed but unverified), F-SEC-19 (no size cap) |
| Rate limiting | F-SEC-17 (XFF spoof), F-SEC-22 (signup) |
| Error / info leakage | F-SEC-20 (no errorFormatter) |
| Magic-link / email | F-SEC-08 (host injection), F-SEC-13 (verification handler missing) |

---

## Remediation priority

1. **Immediate (CRITICAL):** F-SEC-01, F-SEC-02, F-SEC-03, F-SEC-04. None require schema changes; all four are 1-2 day fixes.
2. **Within a week (HIGH):** F-SEC-05, F-SEC-06, F-SEC-07, F-SEC-08, F-SEC-09, F-SEC-10, F-SEC-13.
3. **Sprint backlog (MEDIUM/LOW):** F-SEC-11 through F-SEC-22.

## Notes for follow-up

- Add a `tenant-isolation` test that posts a forged `submitInvoice` with a foreign `storageKey` and asserts a 400 (regression coverage for F-SEC-01).
- Add a `webhook-signature` matrix test that asserts every adapter rejects an inbound payload missing the configured per-org HMAC, including the "no signature header" case (F-SEC-02/03).
- Consider an `instrumentation.ts` module-level assertion that all four Better Auth email handlers (verify, reset, magic-link, invitation) are wired in `NODE_ENV !== 'development'` (F-SEC-13).
- Audit all uses of `prisma.organization.findUnique` in handlers that set `organizationId` from input (vs. derived from session) — they bypass the Prisma tenant extension by construction. Flag for Phase-65+ review.
