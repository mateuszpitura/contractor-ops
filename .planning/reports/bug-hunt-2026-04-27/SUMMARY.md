# Bug-Hunt Summary — 2026-04-27

Five-package parallel audit covering the safe (non-tRPC, non-Prisma) surfaces of the monorepo while the API + DB optimization work proceeds elsewhere.

## Headline numbers

| Package | CRIT | HIGH | MED | LOW | Total | Detail |
|---|---:|---:|---:|---:|---:|---|
| `packages/einvoice` | 1 | 5 | 4 | 3 | **13** | [einvoice.md](./einvoice.md) |
| `packages/integrations` | 2 | 6 | 8 | 3 | **19** | [integrations.md](./integrations.md) |
| `packages/feature-flags` | 0 | 1 | 4 | 3 | **8** | [feature-flags.md](./feature-flags.md) |
| `packages/gov-api` | 0 | 6 | 8 | 5 | **19** | [gov-api.md](./gov-api.md) |
| `packages/auth` | 1 | 3 | 4 | 2 | **10** | [auth.md](./auth.md) |
| **Total** | **4** | **21** | **28** | **16** | **69** | |

`feature-flags` is the cleanest of the five (0 CRIT, 1 HIGH); auth and einvoice each have 1 CRIT; `integrations` has the densest issue concentration. None of the packages are catastrophic — but the cross-cutting patterns matter more than any individual finding.

---

## Top 4 — week-1 priority (CRITICAL, all real bugs)

1. **`packages/integrations` — `ClaudeOcrAdapter` registered with broken contract**
   `src/adapters/register-all.ts:46` casts an OCR-only adapter into the full `IntegrationProviderAdapter` slot via `as unknown as`. The admin Health page (`getAllProviderHealth`) iterates every registered adapter and queries Prisma for `provider: 'CLAUDE'` — not a valid enum value. **Admin Health page will throw on every request.** Fix: split into a separate `ocrRegistry` map.

2. **`packages/einvoice` — Storecove webhook HMAC `RangeError` DoS amplifier**
   `src/asp/storecove/adapter.ts:340-345`. `Buffer.from(headerValue, 'hex')` silently truncates non-hex chars; `timingSafeEqual` then throws `RangeError` on length mismatch. At minimum a 500-amplification on malformed webhooks; potential bypass if any upstream catch maps "verify error" → "valid: false". Fix: hex-shape regex pre-check, length match before `timingSafeEqual`.

3. **`packages/integrations` — DocuSign webhook signature anti-pattern**
   `src/adapters/docusign-adapter.ts:496-507` compares HMAC via `Buffer.from(string)` UTF-8 path without validating that the inbound signature is actually base64. Same shape repeats in Autenti (HIGH). Fix: decode both sides to raw bytes (`createHmac().digest()` returns Buffer, `Buffer.from(sig, 'base64')`), strict regex pre-check, length-check before `timingSafeEqual`.

4. **`packages/auth` — OAuth providers register with `as string` cast over missing env**
   `src/config.ts:27-36`. If `GOOGLE_CLIENT_SECRET` (or any social-provider secret) is unset, Better Auth registers a broken-but-present OAuth endpoint with `undefined` credentials. Silent failure mode that violates project's "no silent failures" rule. Fix: conditional registration + Zod-validated env at module init.

---

## Cross-cutting themes (highest leverage)

These patterns repeat across packages — fixing the pattern, not just one site, gives multiplier impact.

### Theme 1: HMAC/webhook signature verification is consistently wrong-shape
- einvoice/Storecove (CRIT), integrations/DocuSign (CRIT), integrations/Autenti (HIGH), integrations/Resend (MEDIUM)
- Common pattern: `Buffer.from(unvalidatedHeader, 'hex' | 'base64')` → `timingSafeEqual`.
- **Root cause**: no shared webhook-verification helper. Each adapter rolls its own and gets the trust-boundary edge cases wrong.
- **Recommended fix**: extract `verifyWebhookSignature(secret, rawBody, headerValue, encoding)` into `packages/integrations/src/services/webhook-verify.ts` with strict header validation, raw-bytes comparison, and replay-window option. Apply uniformly.

### Theme 2: Token refresh / lock acquisition lacks single-flight protection
- `integrations/token-refresh.ts:88-123` — `lazyRefresh` non-atomic read/write (HIGH)
- `gov-api/clients/hmrc-vat-client.ts:142-147, 223-230` — HMRC refresh stampede (HIGH)
- Common consequence: concurrent callers race on the same OAuth refresh token; one succeeds, others get `invalid_grant` and the user is silently moved to `REAUTH_REQUIRED`.
- **Recommended fix**: cache the in-flight refresh as a `Promise<string>` field; concurrent callers `await` the same promise. ~10-line pattern; apply to every OAuth-bearing client.

### Theme 3: Retry policies retry POSTs blindly
- `integrations/ksef-api-client.ts:103-110, 193-210` — KSeF redeem-token + start-query POSTs retried on 5xx (HIGH)
- `gov-api/client.ts:189-207` — base class retries every method incl. POST (LOW today, latent for future Peppol "send invoice")
- **Recommended fix**: default-skip retries for non-GET; opt-in via explicit idempotency key.

### Theme 4: Silent fail-open on missing config / unreachable backend
- auth/`as string` over OAuth env (CRIT)
- auth/missing `trustedOrigins`/`baseURL` (HIGH)
- auth/`BETTER_AUTH_SECRET` not enforced at boot (MEDIUM)
- feature-flags/kill-switch with `default: true` is non-killable while Unleash is unreachable (MEDIUM)
- integrations/DocuSign hard-coded `demo.docusign.net` fallback (MEDIUM — production-against-demo possible)
- gov-api/Redis-down → rate limiter silently fails open with no log (MEDIUM)
- **Recommended fix**: Zod-validated env schema at module init for all packages with secrets; explicit "fail closed" annotation for kill-switches; document the Unleash-outage semantics.

### Theme 5: Lossy / silent-suffix parsing of monetary values
- einvoice/`engine/xml-utils.ts:toMinorUnits` uses `parseFloat` — accepts `"1190.00 SAR"` as 1190 (HIGH)
- integrations/BoE float comparison without epsilon (HIGH)
- **Recommended fix**: einvoice already has a precision-safe variant in `xrechnung-de/parser.ts` — promote it to shared util, retire the `parseFloat` path. Compare currency rates with `Math.abs(a-b) < 1e-6` or via Decimal.

### Theme 6: Type system bypassed via `as unknown as` — sometimes legitimate, sometimes hiding bugs
- integrations/`ClaudeOcrAdapter` (CRIT — actual contract violation)
- integrations/OCR + E-Sign service runtime checks (MEDIUM — only one method validated of many)
- gov-api/`prisma as unknown as { govApiAuditLog: ... }` (MEDIUM — Prisma types may be stale)
- einvoice/`c14n.process` xmldom bridge (legit — nominal-type bridge between two copies of `@xmldom/xmldom`, low priority documentation)
- einvoice/PDF-lib `lookup()` casts (MEDIUM — error path is dead, fall-through to misleading message)
- **Recommended fix**: per-cast review; the einvoice c14n ones are fine, the integrations + gov-api ones hide real type drift.

### Theme 7: Observability at error paths is inconsistent
- gov-api/no audit entry on thrown fetch errors (MEDIUM) — exactly the failure mode that needs the most observability
- gov-api/Redis silent fail-open (MEDIUM)
- gov-api/no structured logging anywhere (LOW)
- auth/no log/metric on lockout, increment, reset (MEDIUM)
- integrations/Resend swallows errors → bad-secret indistinguishable from bad-signature (MEDIUM)
- feature-flags/disclaimer-gate override returns `reason: 'unleash'` losing audit trail (HIGH)
- **Recommended fix**: standardized log boundary on every error path in security/network code. Pino factory pattern is already established (per memory) — apply uniformly.

---

## Per-package highlights (beyond the CRITs)

### `packages/einvoice` — read [einvoice.md](./einvoice.md)
Tax-authority-bound code, treat with care. Other notable: ZATCA signer regex injection picks first `<ext:ExtensionContent>` slot (HIGH — silent slot-collision risk if UBL ever has multiple); XRechnung Skonto due-date math mixes UTC parse + local-TZ getDate (HIGH — 1-day shift on non-UTC servers); `escapeXml` missing `'` (HIGH — corner-case XAdES verify failure). The hot-spot `as unknown as Element` casts on `c14n.process` are legitimate xmldom nominal-type bridges — verified, no fix needed.

### `packages/integrations` — read [integrations.md](./integrations.md)
Densest issues. Beyond CRITs: BoE poller streams body OUTSIDE the abort window (HIGH — slow-streaming response can hang cron forever); BoE poller can stomp manually-corrected admin rates if effective-date differs by ±2 days (HIGH); Claude OCR model ID `claude-sonnet-4-5-20250514` is wrong format/date (HIGH — OCR fails for any consumer not overriding); ~700 LOC of duplicated `getHealthStatus` boilerplate across 10 adapters (LOW — drift risk).

### `packages/feature-flags` — read [feature-flags.md](./feature-flags.md)
Genuinely well-built — jurisdiction short-circuit fails closed correctly, deep-frozen registry, null-prototype bags, kill-switch defaults tested, disclaimer-gate logic in place. The one HIGH is observability (override returns `reason: 'unleash'` masking the disclaimer-pending state — regulatory audit signal lost). Module-load `process.exit(1)` side effect (MEDIUM) is a real footgun for non-app importers.

### `packages/gov-api` — read [gov-api.md](./gov-api.md)
No CRITs, but every HIGH is an operational blast radius: HMRC OAuth POST has no timeout (entire VAT lookup chain locks if HMRC IDP hangs); retry loop returns stale 5xx when later attempts threw; HMRC token-refresh stampede; raw `response.json()` crashes on HTML error pages from CDNs; raw `ZodError` instead of `HmrcApiError` on schema drift; internal rate-limit mislabelled as upstream 429. Network-boundary discipline needs a uniform pass.

### `packages/auth` — read [auth.md](./auth.md)
Permissions/roles model is genuinely clean and well-tested. The issues are all in the OAuth + lockout edges: OAuth `as string` (CRIT), missing `trustedOrigins`/`baseURL` (HIGH), TOCTOU race on lockout increment+read (HIGH — OWASP ASVS V11.1.4), email enumeration via lockout error message (HIGH — OWASP A07).

---

## Suggested action sequence

**Now (1-2 hours total):**
- Fix integrations CRIT-1 (`ClaudeOcrAdapter` registry split) — the admin Health page is currently broken in any environment that hits `getAllProviderHealth`.
- Fix auth CRIT (OAuth conditional registration with env validation) — silent misconfiguration of social sign-in is high blast radius.

**This week (1-2 days):**
- Centralize webhook signature verification (Theme 1) — fixes 4 sites at once including 2 CRITs.
- Centralize token-refresh single-flight (Theme 2) — fixes 2 HIGHs and unblocks future OAuth providers.
- Switch HMRC clients to `safeParse` + typed errors (gov-api HIGH ×2).

**This sprint:**
- Theme 4 (Zod-validated env across packages) — closes ~6 findings.
- Theme 5 (precision-safe `toMinorUnits` + epsilon comparison) — closes 2 HIGHs.
- gov-api uniform retry/timeout/jitter helper — closes ~5 findings (HIGHs + MEDs).

**Backlog:**
- LOW findings (16 total) — most are duplication / readability with concrete payoff but no urgency.
- Observability theme (7) — best done as a focused infra epic across all 5 packages.

---

## Process notes

- Each package was audited in an isolated subagent context with read-only access. No source files were modified.
- Reports are independent and self-contained — read whichever is relevant.
- The 295-file dirty working tree (Phase 72 in-flight refactor in `apps/web` + `packages/api/src/routers/{compliance,core,equipment,finance,integrations,portal,workflow}/index.ts`) was deliberately ignored. Findings are based on `HEAD` only.
- No findings overlap with `packages/api/` or `packages/db/` since those are off-limits while parallel optimization work proceeds.
