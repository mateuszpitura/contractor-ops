# Stack Research — v6.0 Platform Maturity & Operational Hardening

**Domain:** B2B contractor-ops platform — incremental additions for IdP deprovisioning, compliance document expiry, Gulf operational data, IP-clause detection on contract intake
**Researched:** 2026-04-26
**Confidence:** HIGH for IdP SDK choices and date-fns; MEDIUM for Saudization / UAE free-zone reference data (no maintained libraries — must build static + admin-editable tables); HIGH for "do NOT add new infra" decisions (QStash, Pino, Unleash, Claude Vision OCR all reused)

---

## Executive Decision Summary

| v6.0 Capability | Existing infra reused | Genuinely new dependency |
|-----------------|------------------------|--------------------------|
| IdP deprovisioning — Google Workspace | `googleapis` (already in repo for v3.0 GWS directory import); existing `IntegrationProviderAdapter` + AES-256-GCM credential store | None — extend existing GWS adapter with `users.update({ suspended: true })` |
| IdP deprovisioning — Azure AD/Entra ID | `@microsoft/microsoft-graph-client` (already in repo for v3.0 Teams + Outlook Calendar); `@azure/identity` already installed | None — extend Teams/Calendar provider's credential store; add a new `EntraDeprovisionProvider` adapter sharing the same `MSALConfidentialClient` instance |
| IdP deprovisioning — Okta | — | **NEW** `@okta/okta-sdk-nodejs@8.0.0` |
| IdP deprovisioning — GitHub | `@octokit/rest` may already be present from prior work — verify; if not, add | **MAYBE NEW** `octokit@5.0.5` (or keep `@octokit/rest@22.0.1` — both fine; pick one) |
| IdP deprovisioning — Slack | `@slack/web-api@7.15.1` already in repo for v1.0 Slack messaging | None — add SCIM token credential type to existing Slack adapter; SCIM is raw REST (no SDK methods on `@slack/web-api`) |
| Document expiry engine | QStash (cron + async retries), Prisma 7, Pino logger, Unleash flags, existing `Notification` model + dispatch service | **NEW** `date-fns@4.1.0` for cascade-window arithmetic (lightweight, tree-shakeable, ~13KB) |
| Hard payment block on expired CRITICAL doc | Existing payment-run guard pattern from v1.0 + v3.0 `requireTier` middleware | None — new `requireValidCompliance` tRPC middleware composable with existing chain |
| UAE free-zone registry | Prisma 7, Unleash flag for SA/UAE jurisdiction short-circuit | None — **build static seed table** (~25 zones) committed to repo; Bayanat / official zone portals scraped manually at seed time. No maintained npm package exists. |
| Saudization Nitaqat dashboard | Prisma 7, existing classification engine pattern from v5.0 | None — **build static rule table per Nitaqat 2026–2028 phase** + admin-editable override; logarithmic-formula evaluator in TS. No maintained npm package exists. |
| IP-clause detection on contract upload | Existing Claude Vision OCR adapter (v2.0) + Anthropic SDK already wired; QStash for async classification job; document storage in R2 | None — **reuse `ClaudeOcrAdapter` with a second tool-use schema** (extract clauses + classify presence of IP assignment language). Do NOT add `pdfjs-dist`/`unpdf`/`pdf-parse` for this — Claude Vision handles native PDFs and scanned PDFs uniformly. |
| Knowledge transfer / credential vault | Existing R2 presigned-URL store + portalSession magic-link auth (v2.0) + Better Auth org RBAC + Pino audit log | None — build domain UI on existing primitives. Do NOT introduce a third-party secret-share library. |

**Bottom line:** v6.0 adds **at most three new top-level dependencies** to the monorepo: `@okta/okta-sdk-nodejs`, `date-fns`, and (conditionally, only if `@octokit/rest` is not already present) `octokit`. Everything else is wiring on existing v1.0–v5.0 infrastructure.

---

## Recommended Stack — Identity Provider Deprovisioning

### Core SDKs / API access pattern

| Provider | Library / version | SDK vs raw REST | Why |
|----------|-------------------|------------------|-----|
| Google Workspace | `googleapis@171.4.0` (already installed v3.0) — service `admin('directory_v1').users.update` | **SDK** | Already used by `GoogleWorkspaceAdapter` for directory import; auth helpers (`google.auth.OAuth2`, `GoogleAuth` for service-account domain-wide delegation) are reused; `users.update({ userKey, requestBody: { suspended: true } })` is one method call. Raw REST would duplicate OAuth2 token-refresh logic that `googleapis` already handles. |
| Azure AD / Entra ID | `@microsoft/microsoft-graph-client@3.0.7` + `@azure/identity@4.13.1` (already installed v3.0 Teams + Outlook) | **SDK** for the disable-account `PATCH /users/{id}` and **raw REST POST** for `/users/{id}/revokeSignInSessions` (no fluent method on the v3 client) | The 3.x JS client is the stable production SDK as of 2026-04. The Kiota-generated `@microsoft/msgraph-sdk` (`1.0.0-preview.80`) is **still in preview** — not production-grade. Use `client.api('/users/{id}').update({ accountEnabled: false })` for the disable, and `client.api('/users/{id}/revokeSignInSessions').post({})` for session revocation. |
| Okta | `@okta/okta-sdk-nodejs@8.0.0` (NEW) | **SDK** | The 7.x → 8.x line moved every operation to namespaced `client.userApi.*` (`userApi.deactivateUser({ userId })`, `userApi.revokeUserSessions({ userId })`, `userApi.clearUserSessions({ userId })`). Direct REST would mean reimplementing Okta's API token + DPoP request signing, plus rate-limit headers. SDK is small, well-maintained, and matches our existing adapter pattern. |
| GitHub | `octokit@5.0.5` (recommended) **OR** `@octokit/rest@22.0.1` if already in tree | **SDK** | `octokit.rest.orgs.removeMember({ org, username })` is a one-liner. Both packages are first-party and current; `octokit` is the umbrella SDK and is the one Octokit's docs now lead with — pick `octokit` for new code, keep `@octokit/rest` if it's already wired. |
| Slack | `@slack/web-api@7.15.1` (already installed v1.0) for `admin.users.session.reset` + `admin.users.session.invalidate`; **raw REST + `fetch`** for SCIM `PATCH /scim/v1/Users/{id}` with `active=false` | **Hybrid** | The Web API client covers `admin.*` Enterprise Grid methods. SCIM is **not** modelled on `@slack/web-api` — it's a separate `https://api.slack.com/scim/v1/Users/{id}` endpoint that takes a SCIM-shaped JSON Patch body and uses a different OAuth scope (`scim:write`). Implement as a thin `fetch` wrapper inside the existing Slack adapter — no new dependency. |

### Required OAuth scopes / API permissions (minimum-privilege)

| Provider | Scope / permission | Justification |
|----------|--------------------|---------------|
| Google Workspace | `https://www.googleapis.com/auth/admin.directory.user` (read+write); domain-wide-delegation service account or OAuth admin token | Required to call `users.update` with `suspended: true`. The narrower read-only scope `admin.directory.user.readonly` (used in v3.0 directory import) is **insufficient** — must request the read-write scope at v6.0 connect time and trigger re-consent for existing tenants. |
| Azure AD / Entra ID | `User.EnableDisableAccount.All` (least-privileged for `accountEnabled: false`) **+** `User.RevokeSessions.All` (for `revokeSignInSessions`) | Microsoft published these reduced-privilege scopes specifically for this scenario. Do NOT request `User.ReadWrite.All` — it's broader than needed. Both are **application** permissions (admin-consent required) to allow non-interactive deprovisioning from a cron context. |
| Okta | API token with admin role (or OAuth `okta.users.manage`) — call `userApi.deactivateUser` | The deactivate operation requires user-management privilege. Token must have at minimum the "User Admin" role — not "Group Admin" or read-only. |
| GitHub | OAuth `admin:org` scope — required by `DELETE /orgs/{org}/members/{username}` | `admin:org` is the documented minimum. `repo` scope is insufficient. If using a GitHub App instead of OAuth, request the org `Members: write` permission. |
| Slack | `admin.users.session:write` (Enterprise Grid) for session reset/invalidate **+** `scim:write` (SCIM token from app installation on org, not workspace) for SCIM deactivate | SCIM deactivation requires the org-level OAuth token, not a workspace token. Note: SCIM users cannot be permanently deleted — only deactivated. |

### Auth-layer integration points (existing infra — do NOT duplicate)

- **Credential storage:** add a new `IntegrationProvider` slug per IdP (`okta`, `azure_ad_deprovision`, `github_deprovision`) into the existing AES-256-GCM per-provider credential store. Microsoft Graph and Google credentials are **shared with v3.0** entries — extend the existing `googleAdminDirectory` and `microsoftGraph` provider records with additional scope grants rather than creating duplicates.
- **OAuth callback:** reuse v2.0's generic OAuth callback with HMAC-signed cross-provider CSRF state.
- **Token refresh:** reuse v2.0's proactive token-refresh cron with distributed lock.
- **Audit log:** every revocation step (per-provider success/failure, scopes, timestamp, user-agent of admin who triggered it) flows through existing `AuditLog` Prisma model + Pino logger — no new table.
- **Webhook pipeline:** **not used** for deprovisioning (operations are admin-initiated, fire-and-forget through QStash, then poll for completion if SDK call is asynchronous — Okta has eventual consistency on session revocation).

---

## Recommended Stack — Compliance Document Expiry Engine

### Core libraries

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `date-fns` | `4.1.0` | Reminder-cascade arithmetic (90/60/30/15/7-day windows), `differenceInDays`, `addDays`, `isBefore` for "is in cascade window" checks | Modular tree-shakeable functions; ~13KB after tree-shaking; pure functions are easy to unit-test (no Date mocking needed); the v4 line is current and stable. The maintenance-status warning in some 2026 articles is misleading — v4.1.0 was published recently and the API surface used here (`addDays`, `differenceInDays`, `isAfter`, `isBefore`) is rock-solid. **Tree-shake aggressively** — `import { addDays, differenceInDays } from 'date-fns'` only. |
| Prisma 7 (existing) | — | `ComplianceDocument`, `ComplianceDocumentDefinition` (per-country + per-role required-doc registry), `ComplianceReminderEvent` models | Reuse v1.0 multi-tenant + soft-delete client extensions. |
| QStash (existing) | — | Daily cron at 06:00 org-local that scans `ComplianceDocument WHERE expiresAt - now() ∈ {90d, 60d, 30d, 15d, 7d, 0d, overdue}` and dispatches reminders idempotently (use `(documentId, milestone)` as dedup key into existing `Notification.dedupKey` field) | **Do NOT add BullMQ, Agenda, node-cron, or temporal.io** — QStash already handles cron + retry + signature verification + at-least-once with our `WebhookDelivery` audit trail. |
| Pino logger (existing `@contractor-ops/logger`) | — | Structured event emission per cascade tick | per memory `feedback_logging.md` — never `console.*`. |
| Unleash OSS (existing) | — | Per-jurisdiction feature gate (`compliance-doc-engine-pl`, `…-uk`, `…-de`, `…-uae`, `…-sa`) so a country's required-doc set can be turned off without code changes | per memory `project_feature_flags_strategy.md` — already-decided strategy. |
| `requireTier` middleware (existing v3.0) | — | Gate compliance dashboard behind PRO; gate auto-enforcement (hard payment block) behind ENTERPRISE | Reuse the existing pattern. |

### What we explicitly DO NOT add

| Rejected option | Reason |
|------------------|--------|
| BullMQ | Would duplicate QStash's queue + retry + scheduling. v2.0 / v3.0 already standardised on QStash for `_process` async pipelines. |
| Agenda / node-cron / Bree | Same reason — QStash schedules handle this natively. |
| `cron-parser` standalone | Not needed — QStash schedules accept cron strings directly. |
| temporal.io workflows | Massive over-engineering for a 5-step linear cascade. We have no other Temporal workflows. |
| Specialised "compliance document" SaaS (Drata, Vanta) | Out of scope — those are SOC 2 / ISO 27001 attestation tools, not contractor-document expiry. |
| `js-joda` / `Temporal` polyfill | Premature. Native `Date` + `date-fns` is sufficient — none of the cascade math touches sub-day precision or DST-sensitive operations. |
| Standalone "document expiry tracker" npm packages (e.g. `expiry-tracker`, `date-expiry`) | None are maintained / production-grade. The logic is ~150 lines; building it on Prisma + QStash is faster than vetting a half-maintained dependency. |

### Hard-block payment guard — composition with existing middleware

```ts
// Sketch — compose on top of existing tRPC middleware chain
const requireValidCompliance = createMiddleware(async ({ ctx, next, input }) => {
  const blockers = await ctx.prisma.complianceDocument.findMany({
    where: {
      contractorId: input.contractorId,
      definition: { criticalityForPayment: 'HARD_BLOCK' },
      OR: [{ expiresAt: { lt: new Date() } }, { status: 'MISSING' }],
      orgId: getTenantOrgId(),  // existing AsyncLocalStorage tenant scope
    },
    select: { id: true, definitionCode: true, expiresAt: true },
  });
  if (blockers.length) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'PAYMENT_BLOCKED_EXPIRED_COMPLIANCE_DOC',
      cause: { blockers },  // surfaced in admin UI, never in portal
    });
  }
  return next();
});

// Wired into existing payment.markRunReady + payment.executeRun procedures
```

---

## Recommended Stack — Gulf Operational Polish

### UAE free-zone registry

**Verdict:** No maintained npm package exists. The UAE Bayanat open data portal has *individual* free-zone datasets (Dubai Customs free-zone companies CSV, RAK Maritime city port operating-license charges) but **no consolidated machine-readable list of free-zone authority codes + permitted-activity scope per zone**. Each authority publishes its activity list in a different format (DIFC: rulebooks PDF, ADGM: PDF + dynamic web pages, DMCC: searchable web app, IFZA: PDF, RAKEZ: PDF, JAFZA: PDF, SAIF/DAFZA: PDF). UAE business activities are **broadly** ISIC-aligned but each zone publishes its own permitted-activity subset — no canonical mapping.

**Recommended approach:**

| Step | What to do | Why |
|------|-----------|-----|
| 1. Static seed table in repo | New `packages/db/prisma/seeds/uae-free-zones.ts` with ~25 zones (DIFC, ADGM, JAFZA, DMCC, IFZA, RAKEZ, DAFZA, SAIF, SHAMS, DWTC, DSO, DAFZ, KIZAD, twofour54, DHCC, DIC, DMC, DEZ, FFZ, HFZA, etc.) — code, official Arabic + English name, regulatory body, license-renewal cadence, ISIC top-level categories permitted | One-time research effort; the list is stable on the year-scale. Source from the Federal Tax Authority "Designated Zones" list + each zone's official portal as of seed date. |
| 2. Admin-editable override table | `UaeFreeZoneOverride` Prisma model with org-scoped customisation (per-tenant adjustments + custom zones for clients in zones we haven't seeded) | Avoids needing a code release to add a new zone; supports tenants that operate in non-listed zones. |
| 3. License-expiry scan | Hook into the v6.0 Compliance Document Expiry Engine — the free-zone trade license is just a `ComplianceDocument` with `definitionCode: 'UAE_FREE_ZONE_TRADE_LICENSE'` and `criticalityForPayment: 'SOFT_WARN'` (or HARD_BLOCK depending on tenant policy) | Reuse, don't duplicate. |
| 4. Permitted-activity validator | Free-form text per contractor engagement + admin-editable conflict-warning rules; **do NOT** try to build an exhaustive ISIC-code matcher in v6.0 | The admin-validation pattern matches how v4.0 + v5.0 country-specific validators work (UTR mod-11, Steuernummer regex map). |

**Sources:** [Bayanat UAE Open Data Portal](https://bayanat.ae/), [List of Free Zones in UAE 2026 - Vertix](https://www.vertixauditing.ae/free-zones-in-uae/), [Free Zones in the UAE comparison - RSBM](https://rsbm.ae/tpost/mnn3dx3j11-free-zones-in-the-uae-a-comparative-guid). All MEDIUM confidence — verify each zone's permitted-activity list directly with the authority's portal at seed time. Mark "Needs verification by UAE legal counsel before production deploy" per Standing Project Constraints.

### Saudi Saudization (Nitaqat) tracking

**Verdict:** No maintained npm package exists. The official **Qiwa** platform calculator is the source of truth — it requires a Saudi MOL credential that we don't ship with. The Nitaqat formula transitioned away from fixed company-size bands to a **logarithmic localization-rate formula** with three-year rolling phases; the 2026–2028 phase is published by the Ministry of Human Resources & Social Development (MHRSD).

**Recommended approach:**

| Step | What to do | Why |
|------|-----------|-----|
| 1. Static rule table in repo | `packages/db/prisma/seeds/saudization-rules-2026-2028.ts` keyed by `(sector, companySize, calendarYear)` → required Saudization rate; sector list from the official Nitaqat 2026–2028 announcement | The table is small (~50 sectors × 3 years × 5 size bands) and changes annually — fits in a code-managed seed file with one PR per phase update. |
| 2. Logarithmic-formula evaluator | Pure TS function `computeNitaqatBand({ sector, totalHeadcount, saudiHeadcount, year }) → { band: 'PLATINUM' \| 'GREEN_HIGH' \| ... ; targetRate; gapToNext }` | Mirrors v5.0 IR35 / DRV scoring engines. |
| 3. Workforce composition dashboard | Reuse v5.0 compliance-health-dashboard component pattern (7-component native-flex visualisation, no chart library) — add a "Saudi vs non-Saudi" stacked bar by sector | Reuse, don't duplicate. |
| 4. Nationality field on contractor | Reuse v4.0 country-specific contractor fields infrastructure — add `nationalityIso3` to contractor profile with admin-only edit | One Prisma column. |
| 5. Annual rule-table refresh | Phase-update PR in Q4 of each year — admin gets a banner if the table is older than the current year |  |
| 6. Mark "Needs verification by Saudi legal/HR counsel" | Per Standing Project Constraints — DO NOT hard-block | LOCAL-ONLY posture preserved. |

**Sources:** [Nitaqat Mutawar Program - MHRSD](https://www.hrsd.gov.sa/en/knowledge-centre/decisions-and-regulations/regulation-and-procedures/832742), [New Phase of the Nitaqat Saudization Program (2026–2028)](https://ahysp.com/new-phase-of-the-nitaqat-saudization-program-2026-2028-what-businesses-in-saudi-arabia-need-to-know/), [Jisr HRMS Nitaqat calculator (reference UI)](https://www.jisr.net/en/hr-tools/nitaqat-calculator). MEDIUM confidence on rate values — must be verified against Qiwa portal at seed time and re-verified annually.

---

## Recommended Stack — Offboarding Hardening (IP-clause Detection + Knowledge Transfer)

### IP-assignment clause detection on contract intake

**Verdict:** Reuse the existing v2.0 `ClaudeOcrAdapter` (Claude Vision via Anthropic SDK with native PDF support and `tool_use` for structured extraction). Do **not** add `pdf-parse`, `pdfjs-dist`, `unpdf`, Spark NLP for Legal, or any specialised contract-analysis SaaS.

**Why Claude Vision wins for this:**

1. Already wired — credential store, AI-credit metering (v3.0), confidence scoring, async QStash processing, retry, audit log all exist.
2. Handles native PDFs and scanned PDFs uniformly. `pdf-parse`/`pdfjs-dist` only extract text from native PDFs — they fail on scanned/image-based contracts (which are common, especially in DE/PL where contracts are often scan-imaged after wet-signing). Adding one of those libraries would require a second pipeline branch for OCR fallback that we already have.
3. Tool-use schema gives us structured JSON output (`{ has_ip_assignment_clause: bool, clause_text: string|null, confidence: 0-1, suggested_remediation: string|null }`) — directly maps to a Prisma field on `Contract`.
4. Public benchmark data (ContractEval, Aug 2025) shows Claude Sonnet 4 has Jaccard ≥ 0.45 and a low 0.025 false-no-clause rate on commercial contract clause-level legal-risk identification — best-in-class among the LLMs evaluated for this exact task.
5. Costs are predictable — each contract upload is one ClaudeVision call (we already have credit metering with hard-block).

**Implementation pattern (extend existing adapter):**

```ts
// In ClaudeOcrAdapter — add a second tool definition alongside invoice extraction
const ipClauseTool = {
  name: 'extract_ip_assignment_clause',
  description: 'Identify IP-assignment language in a contractor agreement.',
  input_schema: {
    type: 'object',
    properties: {
      has_ip_assignment_clause: { type: 'boolean' },
      clause_excerpt: { type: 'string', description: 'Verbatim excerpt of the IP clause, or null if absent.' },
      jurisdiction_specific_concerns: {
        type: 'array',
        items: { type: 'string', enum: ['DE_URHEBERRECHT_INALIENABLE', 'UK_PRE_EXISTING_IP', 'PL_AUTHOR_PROPERTY_RIGHTS', 'UAE_MOH_REGISTRATION', 'SA_NEED_NOTARIZATION'] },
      },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      suggested_remediation: { type: 'string' },
    },
    required: ['has_ip_assignment_clause', 'confidence'],
  },
};

// Triggered by contract.uploadDocument fire-and-forget; result lands on Contract.ipClauseHealth field
// Offboarding workflow checks Contract.ipClauseHealth.status before allowing completion
```

**What NOT to use:**

| Rejected | Reason |
|----------|--------|
| `pdf-parse@1.1.1` | Only handles native PDFs; output is unstructured raw text that we'd then have to send to an LLM anyway. Skip the middle step. |
| `pdfjs-dist@5.6.205` | Same. Excellent library for in-browser preview rendering — irrelevant for server-side clause classification. |
| `unpdf@1.6.0` | Better at edge runtime than `pdf-parse` but same fundamental limitation. |
| Spark NLP for Legal | JVM-only. Heavy. Doesn't fit our Node monorepo. |
| LawGeex / Spellbook / Kira-Systems APIs | Closed-source, expensive, English-only, separate vendor relationship for one feature |
| Custom regex on extracted text | Brittle — IP-assignment language varies enormously across PL/UK/DE/UAE/SA legal traditions and Polish + German + Arabic translations. Regex will produce false negatives at unacceptable rates. |

### Knowledge-transfer checklist + credential vault UX

**Verdict:** Build domain UI on existing primitives. Do **not** introduce a third-party "secret-share" library (e.g. `onetimesecret`, `privatebin`, `react-share-secret`). The risk profile of those libraries — many are unmaintained one-person hobby projects — is unacceptable for credential handling.

**Building blocks (all already in repo):**

| Existing primitive | v6.0 use |
|---------------------|-----------|
| R2 presigned URLs (v1.0) | Knowledge-transfer doc handover (architecture diagrams, runbooks) — exactly the same as contract-document storage |
| Document virus scan (ClamAV magic-byte, v1.0) | Same — applied transparently |
| Workflow engine + template builder (v1.0) | Per-role offboarding-checklist templates (engineer / designer / PM / ops) — pure data, no new code |
| `requireTier` middleware (v3.0) | Gate offboarding hardening behind PRO |
| `portalSession` magic-link (v2.0) | Outgoing contractor reads handover materials via portal — already secure |
| Better Auth org RBAC (v1.0) | Receiving teammate reads via internal app with role-scoped access |
| Pino structured logging | Audit trail of every credential-vault read |
| AES-256-GCM credential encryption (v2.0 integration framework) | Reuse the per-resource encryption pattern for "credentials-to-hand-over" rows: encrypt at rest, decrypt at read with audit-log row, expire after 30 days |

**What "credential vault" means here (scoped narrowly):**

1. Outgoing contractor uploads a free-form Markdown handover note + optional file attachments to R2 (existing flow).
2. Outgoing contractor lists "credentials to hand over" — name (e.g. "AWS staging IAM role"), pointer (e.g. "rotated 2026-04-26, request from CTO"), expiry. **No actual secret values ever stored** — we are a coordination layer, not a password manager. If the customer needs a real password manager they should use 1Password / Bitwarden.
3. Receiving teammate ticks off each row when handover is confirmed; structured `AuditLog` row per tick.

**Mark "Needs verification by IT-security contact before production deploy"** per Standing Project Constraints — this section touches sensitive data flows.

---

## Installation

```bash
# IdP deprovisioning — only Okta is genuinely new
pnpm --filter @contractor-ops/integrations add @okta/okta-sdk-nodejs@^8.0.0

# Document expiry engine — only date-fns is genuinely new
pnpm --filter @contractor-ops/api add date-fns@^4.1.0

# (Conditional) GitHub deprovisioning — only if @octokit/rest not already present
pnpm --filter @contractor-ops/integrations add octokit@^5.0.5
# OR keep using existing @octokit/rest@^22 if already installed

# Already in repo — no install needed:
# googleapis@^171.4.0   (v3.0 GWS directory import)
# @microsoft/microsoft-graph-client@^3.0.7  (v3.0 Teams + v2.0 Outlook Calendar)
# @azure/identity@^4.13.1                   (v3.0 Teams)
# @slack/web-api@^7.15.1                    (v1.0 Slack)
# QStash, Pino, Unleash, Anthropic SDK, Prisma 7, pdf-lib, react-pdf — all v1.0–v5.0
```

---

## Alternatives Considered

| Recommended | Alternative | When to use alternative |
|-------------|-------------|-------------------------|
| `@microsoft/microsoft-graph-client@3.0.7` (3 years stale but stable) | `@microsoft/msgraph-sdk@1.0.0-preview.80` (Kiota-generated) | Only when the Kiota line GAs (currently preview). Migration is breaking; defer until v7.x or later. |
| `octokit@5.0.5` umbrella SDK | `@octokit/rest@22.0.1` standalone | Either works. Pick `octokit` for new greenfield code, `@octokit/rest` if it's already in the dependency tree to avoid version skew. |
| Reuse `googleapis@171.4.0` for GWS suspend | Direct Admin SDK REST via `fetch` | Only if we wanted to drop the entire `googleapis` dependency to shave bundle — not relevant for a server-side monorepo. |
| Claude Vision OCR for IP-clause detection | `pdfjs-dist` + custom regex/LLM pipeline | If we wanted on-device extraction with no LLM call (e.g. for self-hosted-by-customer EU deployments where Anthropic API access is restricted). Defer until that customer request lands. |
| Build static UAE free-zone seed table | Scrape Bayanat datasets nightly | Only if/when Bayanat publishes a consolidated zone-list dataset. As of 2026-04 only fragmentary per-zone CSVs exist. |
| Build static Saudization rule table | Pull live from Qiwa portal | Qiwa requires Saudi MOL employer credentials we cannot obtain as a SaaS vendor; static + admin-editable is the only viable path. |
| `date-fns@4.1.0` | `dayjs@1.11.x` / native `Temporal` | `date-fns` is what v1.0 already uses for invoice / contract / deadline date math. Switching would cause a tree-wide refactor. Native `Temporal` is still Stage-3 not yet shipped in Node LTS as of 2026-04. |

---

## What NOT to Use

| Avoid | Why | Use instead |
|-------|-----|-------------|
| BullMQ / Agenda / node-cron / Bree for the expiry engine | We already have QStash for cron + retry + idempotency + audit; second queue layer would create state-of-truth ambiguity | Existing QStash schedules |
| `pdfjs-dist` / `pdf-parse` / `unpdf` for IP-clause detection | Only extracts text; we'd still need an LLM for classification; fails on scanned PDFs | Existing `ClaudeOcrAdapter` with new tool-use schema |
| `@microsoft/msgraph-sdk` (Kiota preview) | Still in preview as of 2026-04; breaking changes between preview releases | `@microsoft/microsoft-graph-client@3.0.7` (already installed) |
| Generic "secret share" npm packages (`onetimesecret`, `privatebin`, etc.) | Most are unmaintained or single-maintainer; unacceptable risk profile for credential UX | Build narrow domain UI on existing R2 + AES-256-GCM + AuditLog primitives |
| LawGeex / Spellbook / Kira-Systems for clause detection | Closed-source SaaS; vendor-lock for one feature; English-only or limited multilingual support | Claude Vision (Anthropic SDK already integrated) |
| Spark NLP for Legal | JVM-only; doesn't fit Node monorepo | Claude Vision |
| Standalone "Saudization" or "UAE free-zone" npm packages | None exist that are maintained / production-grade | Static seed tables + admin-editable overrides in Prisma |
| Adding a second feature-flag system | Existing self-hosted Unleash OSS + thin code wrapper covers per-jurisdiction gating | Existing wrapper (per memory `project_feature_flags_strategy.md`) |
| `console.*` anywhere in v6.0 code | Per memory `feedback_logging.md` and Standing Project Constraints | `@contractor-ops/logger` factories or raw `pino` in standalone scripts |

---

## Stack Patterns by Variant

**If a customer's IdP is not in our supported list (e.g. JumpCloud, OneLogin):**
- Defer. v6.0 covers Google Workspace + Azure AD/Entra + Okta + GitHub + Slack — those cover ~95% of the SMB tech-company target market.
- Document the gap; suggest manual deprovisioning checklist as fallback workflow item.

**If the customer is on Slack Free / Pro (not Enterprise Grid):**
- `admin.users.*` methods all return `not_allowed` on non-Grid plans.
- Detect plan tier on Slack adapter connect; surface a banner: "Slack deprovisioning available on Enterprise Grid only — falls back to manual removal task in offboarding workflow."

**If the customer wants us to integrate with their password manager (1Password / Bitwarden) for actual secret handover:**
- Out of scope for v6.0. Plumbing into vendor-specific password-manager APIs is a v7+ capability.
- v6.0 credential vault is a "pointer + audit trail" only — actual secrets stay in the customer's password manager.

**If the customer requires Steuerberater / Saudi legal / UAE legal sign-off on the rule tables before deploy:**
- Per Standing Project Constraints — code ships, sign-off is recorded as a post-deploy item in the relevant phase SUMMARY's "Manual-Only Verifications" section. LOCAL-ONLY posture preserved.

---

## Version Compatibility

| Package | Compatible with | Notes |
|---------|------------------|-------|
| `@okta/okta-sdk-nodejs@8.0.0` | Node 18+ | 7.x → 8.x is breaking — operations moved to namespaced `client.userApi.*`, `groupApi.*` etc. We are on a clean install so no migration cost. |
| `@microsoft/microsoft-graph-client@3.0.7` | `@azure/identity@4.x`, Node 18+ | If running Node 18, pass `--no-experimental-fetch` per Microsoft's recommendation, or pin to `node@20`+ which is our Render baseline. |
| `googleapis@171.4.0` | `google-auth-library@9.x` (transitive) | We're already on 171.x for v3.0 — no change. Major version bumps are frequent (typically every 1-2 weeks) but binary-compatible within a major; keep in caret range `^171`. |
| `octokit@5.0.5` | Node 20+ (ESM-only) | If we still have CommonJS builds in any package, we must use the ESM-preserving import pattern (`await import('octokit')`) or migrate the consuming package to ESM. |
| `@slack/web-api@7.15.1` | Node 18+ | SCIM endpoints are NOT exposed by the SDK — implement via `fetch` in the existing Slack adapter. |
| `date-fns@4.1.0` | TypeScript 5.x, ESM + CJS | The v3 → v4 jump dropped IE11 + CommonJS-only patterns, but our tooling is fine. |
| Prisma 7 (existing) | `@prisma/adapter-neon` (existing) | New v6.0 models add only forward migrations — no schema breakage. |

---

## Sources

### Context7 / official docs (HIGH confidence)

- `/websites/googleapis_dev_nodejs_googleapis` — `directory_v1` users.update, OAuth2 scopes, GoogleAuth keyFile patterns
- `/microsoftgraph/microsoft-graph-docs-contrib` — `POST /users/{id}/revokeSignInSessions` (204 No Content), `PATCH /users/{id}` with `accountEnabled: false`, `User.EnableDisableAccount.All` reduced-privilege scope
- `/okta/okta-sdk-nodejs` — `client.userApi.deactivateUser({ userId })`, `client.userApi.revokeUserSessions({ userId })`, 7.x → 8.x breaking-change diff
- `/octokit/octokit.js` — `octokit.rest.*` namespaced endpoint methods, `DELETE /orgs/{org}/members/{username}`, OAuth `admin:org` scope
- `/websites/slack_dev_reference_methods` — `admin.users.session.invalidate`, `admin.users.session.reset`, SCIM `/scim/v1/Users/{id}` PATCH active=false
- `/date-fns/date-fns@v3.5.0` — `differenceInDays`, `addDays`, `isBefore`, `compareAsc` reference (4.x is API-compatible for the functions used)

### Official documentation (HIGH confidence)

- [Microsoft Graph: revokeSignInSessions API reference](https://learn.microsoft.com/en-us/graph/api/user-revokesigninsessions) — minimum-privilege permissions
- [Microsoft Graph: SDK overview (3.x stable vs Kiota preview)](https://learn.microsoft.com/en-us/graph/sdks/sdks-overview)
- [Slack: Using the SCIM API](https://docs.slack.dev/admins/scim-api/) — `scim:write` scope, org-token requirement, deactivate-only (no permanent delete)
- [Slack: Manage members with SCIM provisioning](https://slack.com/help/articles/212572638-Manage-members-with-SCIM-provisioning)
- [GitHub REST: Remove an organization member](https://docs.github.com/en/rest/orgs/members#remove-an-organization-member) — `admin:org` scope
- [Okta: Lifecycle Management](https://developer.okta.com/docs/reference/api/users/#lifecycle-operations) — deactivate, clear sessions, revoke sessions
- [date-fns documentation](https://date-fns.org/) — current API + v4 release notes

### Web research (MEDIUM confidence — verified against multiple sources)

- [Bayanat UAE Open Data Portal](https://bayanat.ae/) — confirms no consolidated free-zone activity dataset
- [List of Free Zones in UAE 2026 - Vertix](https://www.vertixauditing.ae/free-zones-in-uae/) — secondary cross-reference for zone list
- [Free Zones in the UAE: comparative guide DMCC, RAKEZ, IFZA, DAFZA, ADGM - RSBM](https://rsbm.ae/tpost/mnn3dx3j11-free-zones-in-the-uae-a-comparative-guid)
- [MHRSD Nitaqat Mutawar Program](https://www.hrsd.gov.sa/en/knowledge-centre/decisions-and-regulations/regulation-and-procedures/832742) — official Saudi MOL source
- [New Phase of the Nitaqat Saudization Program (2026–2028) - AHYSP](https://ahysp.com/new-phase-of-the-nitaqat-saudization-program-2026-2028-what-businesses-in-saudi-arabia-need-to-know/) — 2026–2028 phase changes
- [Mondaq: New Phase Of The Nitaqat Saudization Program (2026-2028)](https://www.mondaq.com/saudiarabia/contracts-and-commercial-law/1754286/new-phase-of-the-nitaqat-saudization-program-20262028-what-businesses-in-saudi-arabia-need-to-know)
- [Jisr HRMS Nitaqat calculator](https://www.jisr.net/en/hr-tools/nitaqat-calculator) — reference UI / formula behaviour
- [ContractEval: LLMs for Clause-Level Legal Risk Identification (Aug 2025)](https://arxiv.org/pdf/2508.03080) — Claude Sonnet 4 Jaccard ≥ 0.45, false-no-clause rate 0.025
- [Anthropic: Legal summarization use-case guide](https://platform.claude.com/docs/en/about-claude/use-case-guides/legal-summarization) — confirms Claude's clause-extraction capability
- [PkgPulse: unpdf vs pdf-parse vs pdfjs-dist (2026)](https://www.pkgpulse.com/blog/unpdf-vs-pdf-parse-vs-pdfjs-dist-pdf-parsing-extraction-nodejs-2026) — confirms structural-extraction tradeoffs we explicitly avoid

### npm registry version verification (HIGH confidence — fetched 2026-04-26)

- `googleapis@171.4.0`, `@microsoft/microsoft-graph-client@3.0.7`, `@azure/identity@4.13.1`, `@okta/okta-sdk-nodejs@8.0.0`, `octokit@5.0.5`, `@octokit/rest@22.0.1`, `@slack/web-api@7.15.1`, `date-fns@4.1.0`, `unpdf@1.6.0`, `pdfjs-dist@5.6.205`, `@microsoft/msgraph-sdk@1.0.0-preview.80` — all checked via `npm view <pkg> version` directly.

---

*Stack research for: v6.0 Platform Maturity & Operational Hardening*
*Researched: 2026-04-26*
*Confidence: HIGH on SDK choices and "do not add" decisions; MEDIUM on Saudization + UAE free-zone reference data (no maintained libraries — static seed tables + admin overrides + post-deploy legal sign-off).*
