# Test Matrix — QA Full Surface Audit

> Deliverable A. Instantiates every fact in [`facts.md`](./facts.md) per concrete surface from the verified inventory. Each row is marked **`auto`** (covered by an automated test, existing or added by this goal), **`manual`** (verifiable only by hand — RTL visual, real-OCR, live-sandbox), or **`mock-only`** (asserted against MSW/Prisma mocks; cannot catch real-provider contract drift).
>
> Risk order: **security/auth/IDOR → money/data integrity → integration correctness → input/UX**. Target test files use the existing harness (`createCallerFactory(appRouter)(ctx)`, `@contractor-ops/test-utils` MSW, `vi.fn()` Prisma mocks). New security tests **extend** the 6 baseline `*.security.test.ts`, never duplicate.
>
> Inventory verified 2026-06-16 by two investigator passes against `packages/api/src/root.ts`, `portal-root.ts`, `packages/integrations/src/adapters/`, `apps/cron-worker/src/jobs/registry.ts`, `apps/public-api/src/routes/`, `packages/feature-flags/src/flags-core.ts`, `packages/auth/src/roles.ts`, and `apps/web-vite/src/components/`.

## Legend

| Mark | Meaning |
|------|---------|
| `auto` | Automated test exists or is added here; runs under a scoped `pnpm --filter` command |
| `manual` | Correctness needs a human (visual RTL, real OCR extraction, live provider sandbox); marked, never a silent gap |
| `mock-only` | Exercised only against mocks; real-provider contract drift is out of scope (`RUN_LIVE_SMOKE=1` not run) |
| Tier | 1 = security/auth/IDOR · 2 = money/data · 3 = integration · 4 = input/UX |
| Status | `pass` / `pending` (test to be written) / `baseline` (pre-existing green) / `gap` (documented, not automated) |

---

## Inventory cross-check (every surface appears below ≥1×)

| Surface area | Count (verified) | Source of truth |
|--------------|------------------|-----------------|
| Staff tRPC namespaces | 47 always-on + 8 classification-gated + 1 us-expansion-gated = **56** | `packages/api/src/root.ts` |
| Portal namespaces | **2** (`portal`, `portalTime`) | `packages/api/src/portal-root.ts` |
| Outbound adapters | **20** | `packages/integrations/src/adapters/` |
| Inbound webhook routes | **6** (stripe, storecove, inpost, multi-provider, _process, revalidate-legal) covering 11 providers | `apps/api/src/routes/webhooks/` |
| QStash / cron jobs | **12** registered + classification subjobs | `apps/cron-worker/src/jobs/registry.ts` |
| public-api REST endpoints | **11** (5 resource pairs + feature-flags + 3 utility) | `apps/public-api/src/routes/` |
| Middleware / auth gates | **18** | `packages/api/src/middleware/` |
| Feature flags | **45** (32 signoff-gated, 1 killWhenUnknown, 27 ship-dark) | `packages/feature-flags/src/flags-core.ts` |
| Org roles | **9** + `platform_operator` | `packages/auth/src/roles.ts` |
| Forms | **24** | `apps/web-vite/src/components/` |
| Dialogs / modals | **52** (10 destructive, 4 wizards) | `apps/web-vite/src/components/` |
| Wizards | **4** (contractor 3-step, contract 2-step, import 5-step, tax-form 4-step) + org onboarding | `apps/web-vite/src/components/` |
| Upload entry points | **12** | `apps/web-vite/src/components/` |

---

## Tier 1 — Auth & session (facts.md §Auth & session)

| Fact | Surface / case | Expected | Mode | Tier | Target file | Status |
|------|----------------|----------|------|------|-------------|--------|
| Email+pw needs verification | sign-up → unverified session | no tenant access until verified (`requireEmailVerification:true`) | auto | 1 | `auth/session-invariants.security.test.ts` | pending |
| 5 fails → 15min lock | 6th sign-in in window | rejected even with correct creds | auto | 1 | `auth/session-invariants.security.test.ts` | pending |
| Sign-in 10/min per IP; sign-up needs Turnstile | rate-limit + CAPTCHA | 11th/min rejected; missing token rejected | auto | 1 | `auth/session-invariants.security.test.ts` | pending |
| Disabled member lockout | `Member.disabledAt` set → create/refresh session | session denied immediately | auto | 1 | `auth/session-invariants.security.test.ts` | pending |
| Google auto-link verified only; MS rejected | OAuth account-link | Google verified ok; MS consumer-tenant rejected | auto | 1 | `auth/oauth-link.security.test.ts` | pending |
| `dataRegion` immutable | org update region | set once from `billingCountry`, immutable after | auto | 1 | `auth/session-invariants.security.test.ts` | pending |
| SUSPENDED/ARCHIVED org rejected | `tenantMiddleware` (`tenant.ts:212`) | only ACTIVE resolves | auto | 1 | extend `tenant-isolation-extra.security.test.ts` | baseline+ext |
| Portal cookie HMAC 24h | tampered/expired `portal_session` | `portalAuthMiddleware` (`portal-auth.ts:42`) rejects | auto | 1 | `portal-idor.security.test.ts` | pending |
| API-key `co_live_*` only, non-revoked/expired/ACTIVE | `apiKeyAuthMiddleware` (`api-key-auth.ts:26`) | revoked/expired/wrong-prefix rejected | auto | 1 | extend `integration-config-leak` / new `apikey-auth.security.test.ts` | pending |
| Sensitive ≤5min freshness | role change, member deactivate, payment-run | stale session rejected (`sensitive.ts:19`) | auto | 1 | `auth/session-invariants.security.test.ts` | pending |
| No-org user → onboarding, no throw | new user resolves `OrganizationOnboarding` | never `tenantNoActiveOrganization` | auto | 1 | `auth/session-invariants.security.test.ts` | pending |

---

## Tier 1 — Authorization & roles (facts.md §Authorization & roles)

Role→permission source: `packages/auth/src/roles.ts:44–180`, `permissions.ts:12–46`. Matrix = 9 roles × gated resources.

| Fact | Surface / case | Expected | Mode | Tier | Target file | Status |
|------|----------------|----------|------|------|-------------|--------|
| Each role = exact permission set | 9 roles × {contractor,contract,invoice,payment,settings,member,integration,report,time,equipment,document,workflow,compliance,contractorPii,admin:boe-rate} | grant only documented; FORBIDDEN elsewhere | auto | 1 | extend `authz-permission-matrix.security.test.ts` | baseline+ext |
| `contractorPii:read` owner/admin/finance_admin only | `contractor.revealSsn` per role | other 6 roles denied | auto | 1 | extend `authz-permission-matrix.security.test.ts` | baseline+ext |
| FORBIDDEN session + api-key | `requirePermission` (`rbac.ts:19`) both paths | both reject missing perm | auto | 1 | extend `authz-permission-matrix.security.test.ts` | baseline+ext |
| Role change no cookie-cache delay | re-read perm every call | next call reflects new role | auto | 1 | extend `role-escalation.security.test.ts` | baseline+ext |
| `platform_operator` cross-tenant boe-rate, no per-org | `adminBoeRate` r/w; any per-org denied | global only | auto | 1 | `authz-permission-matrix.security.test.ts` | pending |
| `requireTier` STARTER/PRO/ENTERPRISE | under-tier caller (`tier.ts:31`) | rejected | auto | 1 | `authz-tier-addon.security.test.ts` | pending |
| `requireAddOn` workforce / us-cross-border | no add-on (`add-on.ts:28`) | rejected | auto | 1 | `authz-tier-addon.security.test.ts` | pending |
| Demo-mode blocks mutation unless `allowInDemo` | `demoReadOnly` (`demo.ts:26`) | mutation blocked; tagged ok | auto | 1 | `authz-tier-addon.security.test.ts` | pending |
| Role-gated UI hides/disables actions | Add Contractor, Deactivate, Create API Key, workflow-role CRUD | hidden, not just server-rejected | manual | 4 | scoped RTL (5c) / visual | gap (server side auto) |

---

## Tier 1 — Tenant isolation & IDOR (facts.md §Tenant isolation & IDOR)

| Fact | Surface / case | Expected | Mode | Tier | Target file | Status |
|------|----------------|----------|------|------|-------------|--------|
| Staff query/mutation org-scoped via tenant extension | foreign-org record | never returned/mutated | auto | 1 | extend `tenant-isolation-extra.security.test.ts` | baseline+ext |
| `SET LOCAL app.org_id` + `withRlsReads` | Document/Invoice/Contractor/ApprovalStep/Notification | app-layer scoping asserted; **DB policy not deployed → flagged** | auto (app) / gap (DB) | 1 | `tenant-isolation-extra.security.test.ts` | baseline + documented gap |
| Portal rows by `contractorId` | invoices, contracts, equipment, profile, tax-form with foreign id | no cross-contractor leak | auto | 1 | `portal-idor.security.test.ts` | pending |
| API keys scoped from key not client org | `apiKeyAuthMiddleware` | client-supplied org ignored | auto | 1 | `apikey-auth.security.test.ts` | pending |
| Doc download URLs server-presigned, no org id | expired/invalid presigned URL | rejected | auto | 1 | `portal-idor.security.test.ts` / document router test | pending |
| Staff `getInvoice/getContract(id)` reject foreign-org id | org scope | rejected; intra-org behavior tested as designed | auto | 1 | extend `tenant-isolation-extra.security.test.ts` | baseline+ext |

---

## Tier 1 — Audit (facts.md §Audit)

| Fact | Surface / case | Expected | Mode | Tier | Target file | Status |
|------|----------------|----------|------|------|-------------|--------|
| `writeAuditLog` full record | org, actor, action, resource, old/new, ip, ua | all fields present | auto | 1/2 | `audit-coverage.test.ts` | pending |
| AuditLog append-only | UPDATE/DELETE on row | rejected | auto | 1 | `audit-coverage.test.ts` | pending |
| Audit inside same tx (`tx` passed) | contract amend/bulk, approval decision, portal W-form submit, profile update, equipment return/shipment, reassessment ack/dismiss | audit row committed atomically with change | auto | 1/2 | `audit-coverage.test.ts` | pending |
| Audit coverage gaps verified | member deactivate/reactivate, org update/delete, payment-run export/lock, settings update, api-key create/revoke | pass OR documented gap | auto/gap | 1 | `audit-coverage.test.ts` | pending (some likely gap) |
| Audit CSV export gated settings:read, own org only | `audit.export` | only caller org rows | auto | 1 | `audit-coverage.test.ts` | pending |

---

## Tier 2 — Money / data integrity (facts.md §Integrations-outgoing payment + §Uploads bank)

| Fact | Surface / case | Expected | Mode | Tier | Target file | Status |
|------|----------------|----------|------|------|-------------|--------|
| Payment export format per destination | CSV, Elixir/Plux (PL), SEPA_XML, SWIFT_XML, BACS_STD18 | each validates against spec | auto | 2 | `payment-export-formats.test.ts` | pending |
| Atomic DRAFT/LOCKED→EXPORTED once; idem dedupe | `payment` export | one transition; dup `idempotencyKey` deduped | auto | 2 | complements `payment-export-race.security.test.ts` | pending |
| Bank-statement parser per format | CSV/OFX/MT940/PDF extract; malformed → typed error | no crash | auto | 2 | `bank-statement.test.ts` (gap fill) | pending |
| Money rounding invariants | invoice/payment totals, skonto, late-interest | `patterns/money-rounding` holds | auto | 2 | `money-rounding.test.ts` | pending |
| Idempotency key stability + per-provider header | `deriveIdempotencyKey(orgId,operation,businessKey)` | stable `sha256`; provider header mapping | auto | 2 | `idempotency.test.ts` | pending |
| Outbox drain dedupe | redrained event id | deduped, exactly-once | auto | 2 | `idempotency.test.ts` | pending |
| Deprovisioning `(orgId, idempotencyKey)` dedupe | Entra/Okta/GitHub/GWS/Slack re-run | no repeat side effects | auto | 2/3 | `idempotency.test.ts` | pending |
| PEPPOL/ZATCA enqueue w/ idem + retry | peppol.outbound retries 5, zatca.submit retries 3 | records transmission state | auto | 2/3 | `idempotency.test.ts` / adapter test | pending |

---

## Tier 3 — Integrations outgoing — adapters (facts.md §Integrations-outgoing)

20 adapters. Each: request shape + resilience under MSW (degraded, rate-limited, token-expired, partial-failure, replay).

| Adapter | Signing/idem | Case | Mode | Tier | Target file | Status |
|---------|--------------|------|------|------|-------------|--------|
| docusign | HMAC + OAuth, idKey | create→url→signed→void/resend map; errors surface | mock-only | 3 | `adapters/docusign.test.ts` / `esign-lifecycle.test.ts` | pending |
| autenti | HMAC + OAuth | envelope lifecycle; errors surface | mock-only | 3 | `esign-lifecycle.test.ts` | pending |
| google-calendar | OAuth | deterministic event id base32hex; re-issue no-op | auto | 3 | `adapters/calendar-eventid.test.ts` | pending |
| outlook-calendar | OAuth | deterministic event id RFC-4122 v5; upsert no-op | auto | 3 | `adapters/calendar-eventid.test.ts` | pending |
| storecove (PEPPOL) | HMAC | outbound shape + idem; transmission state | mock-only | 3 | `adapters/storecove.test.ts` | pending |
| ksef | cert + OAuth | submit shape + idem | mock-only | 3 | `adapters/ksef.test.ts` | pending |
| resend | HMAC webhook | email `Idempotency-Key` (sha256 from\|to\|subj\|body) | auto | 3 | `notification-email.test.ts` | pending |
| slack | HMAC | chat post / deprovision shape; degraded handling | mock-only | 3 | `adapters/slack.test.ts` | pending |
| jira | OAuth Bearer | issue/project shape; rate-limited handling | mock-only | 3 | `adapters/jira.test.ts` | baseline (router test exists) |
| linear | OAuth Bearer | team/status shape; partial-failure | mock-only | 3 | `adapters/linear.test.ts` | baseline (router test exists) |
| teams | OAuth Bearer | channel/member; deprovision | mock-only | 3 | `adapters/teams.test.ts` | baseline (router test exists) |
| google-workspace | OAuth Bearer | directory import/sync/deprovision; idem | mock-only | 3 | `adapters/gws.test.ts` | pending |
| okta | OAuth Bearer | deprovision; `(org,idemKey)` dedupe | mock-only | 3 | `idempotency.test.ts` | pending |
| entra-id | OAuth Bearer | deprovision dedupe | mock-only | 3 | `idempotency.test.ts` | pending |
| github | OAuth Bearer | deprovision dedupe | mock-only | 3 | `idempotency.test.ts` | pending |
| notion | OAuth Bearer | db sync shape | mock-only | 3 | covered via webhook schema test | pending |
| confluence | OAuth Bearer | page discovery | mock-only | 3 | covered via webhook schema test | pending |
| clockify | OAuth Bearer | time sync shape | mock-only | 3 | `adapters/clockify.test.ts` | gap (low risk) |
| dataport-company-registry | none | DE lookup shape | mock-only | 3 | `adapters/registry-lookup.test.ts` | gap (low risk) |
| bir1-company-registry | none | PL GUS lookup shape | mock-only | 3 | `adapters/registry-lookup.test.ts` | gap (low risk) |
| claude-ocr | API key | OCR call; killswitch honored | manual (real OCR) / auto (gating) | 3/4 | `feature-flags evaluator` + manual | partial |

---

## Tier 1/3 — Inbound webhooks (facts.md §Integrations-inbound)

| Provider | Route / file | Signature | Case | Mode | Tier | Target file | Status |
|----------|--------------|-----------|------|------|------|-------------|--------|
| Stripe | `/webhooks/stripe` (`stripe.ts:55`) | `stripe-signature` | bad sig rejected; `StripeEvent.processedAt` dedupe; 24h age | auto | 1/3 | `webhook-signature.security.test.ts` + `webhooks/stripe.test.ts` | pending |
| Storecove | `/webhooks/storecove` (`storecove.ts:73`) | HMAC-SHA256 | missing/invalid sig rejected; guid idem | auto | 1/3 | `webhook-signature.security.test.ts` | pending |
| InPost | `/webhooks/inpost` | adapter HMAC | bad sig rejected | auto | 1/3 | `webhook-signature.security.test.ts` | pending |
| Jira | `/webhooks/:provider` (`multi-provider.ts`) | `X-Hub-Signature` per-conn | bad sig rejected | auto | 1/3 | `webhook-signature.security.test.ts` | pending |
| Linear | `/webhooks/:provider` | `linear-signature` per-conn | bad sig rejected | auto | 1/3 | `webhook-signature.security.test.ts` | pending |
| Slack | `/webhooks/:provider` | teamId lookup + schema | unknown team rejected | auto | 1/3 | `webhook-signature.security.test.ts` | pending |
| DocuSign | `/webhooks/:provider` | per-connection HMAC | bad sig rejected | auto | 1/3 | `webhook-signature.security.test.ts` | pending |
| Autenti | `/webhooks/:provider` | per-connection HMAC | bad sig rejected | auto | 1/3 | `webhook-signature.security.test.ts` | pending |
| Notion | `/webhooks/:provider` | schema-only | Zod-invalid rejected | auto | 1/4 | `webhook-signature.security.test.ts` | pending |
| Confluence | `/webhooks/:provider` | schema-only | Zod-invalid rejected | auto | 1/4 | `webhook-signature.security.test.ts` | pending |
| QStash drain | `/webhooks/_process` (`process.ts:55`) | Upstash `Receiver` HMAC | atomic claim RECEIVED→PROCESSING→PROCESSED/FAILED; replay not 2× | auto | 1/3 | `webhooks/drain.test.ts` | pending |
| CMS revalidate | `/revalidate-legal` | `REVALIDATE_LEGAL_SECRET` | bad secret rejected | auto | 1 | `apps/api/.../revalidate-legal.test.ts` (exists) | baseline |
| handler-throw → FAILED + retry | drain | marked FAILED, retried to cap, not lost | auto | 3 | `webhooks/drain.test.ts` | pending |

---

## Tier 3/4 — Notifications & email (facts.md §Notifications & email)

| Fact | Surface / case | Expected | Mode | Tier | Target file | Status |
|------|----------------|----------|------|------|-------------|--------|
| dispatch always creates Notification, dedupe `(org, dedupKey)` | duplicate event | no 2nd notification | auto | 3 | `notification-dispatch.test.ts` | pending |
| Email `Idempotency-Key` (sha256 / OutboxEvent.id) | resend in window | not delivered 2× | auto | 3 | `notification-email.test.ts` | pending |
| Email/Slack/Teams failure non-fatal | provider throw inside dispatch | in-app notification still persists | auto | 3 | `notification-dispatch.test.ts` | pending |
| Templates localized en/pl/de/ar (RTL ar) | render subject+body | localized; ar RTL | manual (visual) / auto (key presence) | 4 | partial auto + manual | partial |
| In-app UI loading/empty/populated; mark-read/all | notification panel | states correct | manual | 4 | scoped RTL | gap |
| Notification preferences gate channels | org + portal prefs | only enabled channels fire | auto | 3 | `notification-dispatch.test.ts` | pending |

---

## Tier 1/4 — Feature flags & jurisdiction (facts.md §Feature flags)

| Fact | Surface / case | Expected | Mode | Tier | Target file | Status |
|------|----------------|----------|------|------|-------------|--------|
| Flags only via wrapper | no direct Unleash SDK in apps | grep-clean | auto | 4 | `evaluator.test.ts` + lint | pending |
| `jurisdiction:'EU'` false for ME & vice-versa | evaluator short-circuit | regardless of Unleash | auto | 4 | `evaluator.test.ts` | pending |
| Every module flag default false, hides UI + namespace | classification-engine, us-expansion, workforce-employees, public-api, outbound-webhooks, iris-efile, idp-deprovisioning-gws/slack, legal-approval | off → hidden + NOT_FOUND | auto | 1/4 | `flag-gating.security.test.ts` + `evaluator.test.ts` | pending |
| classification-engine off / disclaimer PENDING hides IR35 UI + namespaces | kill-switch overrides Unleash | classification NOT_FOUND | auto | 1 | `flag-gating.security.test.ts` | pending |
| us-expansion off → `taxForm` + portal W-form NOT_FOUND/hidden | on → resolve | flag gate (`require-us-expansion-flag.ts:29`) | auto | 1 | `flag-gating.security.test.ts` | pending |
| `killswitch.ai-invoice-parser` killWhenUnknown:true | Unleash outage | forces OFF; OCR disabled | auto | 4 | `evaluator.test.ts` | pending |
| Each flag-gated procedure NOT_FOUND when off | per gated namespace | documented error | auto | 1 | `flag-gating.security.test.ts` | pending |

---

## Tier 4 — Uploads (facts.md §Uploads)

| Upload | File | Accept / cap | Case | Mode | Tier | Target file | Status |
|--------|------|--------------|------|------|------|-------------|--------|
| Bank statement | `payments/bank-statement-dialog.tsx` | .mt940/.csv, 10MB | wrong type rejected; oversize rejected pre-parse | auto | 4 | `bank-statement.test.ts` + scoped RTL | pending |
| Import (contractor/contract/cost-center) | `import/import-wizard-dialog.tsx` | .csv/.xlsx, 10MB | malformed CSV → row-level fail, no partial commit | auto | 4 | `routers/import.test.ts` (exists) + scoped RTL | baseline+ext |
| E-invoice intake | `invoices/intake/intake-upload-dialog.tsx` | .xml/.pdf, 5MB, XSD+BASIC | invalid XML rejected | auto | 4 | `invoice-intake.test.ts` | pending |
| Portal invoice | `portal/invoice-submit-form.tsx` | PDF/JPG/PNG | wrong type rejected; OCR killswitch fallback | auto/manual | 4 | scoped RTL + evaluator | partial |
| Tax-form doc | `portal/tax-forms/` | PDF/image | type gate | manual | 4 | scoped RTL | gap |
| Compliance doc | `contractors/compliance/upload-review-dialog.tsx` | generic, OCR-gated | OCR killswitch honored | auto (gating) | 4 | evaluator | partial |
| Branding logo | settings branding | PNG/JPG/SVG | type gate | manual | 4 | scoped RTL | gap |
| Contract docs | `contracts/contract-wizard/step-documents.tsx` | PDF | type gate | manual | 4 | scoped RTL | gap |
| Equipment/carrier | `equipment/*` | image | type gate | manual | 4 | scoped RTL | gap |
| Portal compliance replace | `portal/compliance/portal-upload-replacement-form.tsx` | generic | type gate | manual | 4 | scoped RTL | gap |
| Onboarding import | `onboarding/import-wizard.tsx` | .csv/.xlsx, 10MB | delegates to import | auto | 4 | `routers/import.test.ts` | baseline |
| GWS directory import | `integrations/google-workspace/directory-import-wizard.tsx` | .csv | type gate | mock-only | 4 | `adapters/gws.test.ts` | gap |
| Upload rate-limit | `upload-rate-limit.ts` | excess throttled | 429 on excess | auto | 1/4 | `apikey-auth.security.test.ts` / upload test | pending |
| Bank parser malformed → error not crash | parser | typed parse error | auto | 2 | `bank-statement.test.ts` | pending |
| OCR killswitch fallback | portal/staff OCR | off → store w/o OCR, manual-entry UI | auto (gating) / manual (UI) | 4 | evaluator + manual | partial |

---

## Tier 4 — Forms, modals, wizards (facts.md §Forms/modals/wizards)

| Fact | Surface / case | Expected | Mode | Tier | Target file | Status |
|------|----------------|----------|------|------|-------------|--------|
| Form blocks submit + field errors | all 24 forms, required empty/malformed | no silent fail, no 500 | manual (RTL) + auto (Zod) | 4 | scoped RTL + Zod boundary | partial |
| Every procedure Zod-validated | representative procedures, bad payload | typed validation error, not unhandled | auto | 4 | `zod-boundary.test.ts` | pending |
| Boundary inputs rejected | neg/zero amount, future/past date, bad NIP/VAT-EU, bad IBAN, over-long, unicode/RTL, XSS/SQL | rejected/neutralized → typed error, no 500 | auto | 4 | `zod-boundary.test.ts` | pending |
| Wizards preserve state, gate steps, commit on final | contractor 3, contract 2, import 5, tax-form 4, org onboarding | back/next state; invalid blocks; commit last | manual (RTL) | 4 | scoped RTL (5c) | partial |
| Tax-form branch W-9/W-8BEN/W-8BEN-E + perjury+typed-name | determination step | branch correct; attest enforced | manual (RTL) + auto (router submit) | 4 | scoped RTL + portal-tax router test | partial |
| Destructive dialogs require confirm | 10 destructive (revoke API key, deactivate member, void envelope, delete BOE rate, delete/create Leitweg-ID, PEPPOL deregister, override compliance, revoke waiver, mark delivered, attach-doc delete) | confirm before fire | manual (RTL) | 4 | scoped RTL | gap |
| Import duplicate merge/skip deterministic | re-run | no duplicate records | auto | 2/4 | `routers/import.test.ts` (exists) | baseline+ext |
| Jurisdiction/flag-gated forms region+flag | BACS UK-GBP, Skonto DE, e-invoice EU, Saudization ME, W-form US | appear only for region+flag | auto | 1/4 | `flag-gating.security.test.ts` + evaluator | pending |

---

## Tier 4 — UI states (facts.md §UI states)

| Fact | Surface / case | Expected | Mode | Tier | Target file | Status |
|------|----------------|----------|------|------|-------------|--------|
| Loading/empty/error per wired section | failed query | error banner + retry, not blank | manual (RTL) | 4 | scoped RTL | gap |
| Data-layer rules hold | page/section/hook layering | `check:web-vite-data-layer/page-shells/presentational` pass | auto | 4 | the 3 `check:*` scripts | pending |
| RTL (ar) renders correctly | major surfaces | no clip/mirror break | manual | 4 | visual | gap |
| Toasts correct success/error key per mutation | 12 common keys + per-domain | correct key | manual (RTL) | 4 | scoped RTL | gap |

---

## Tier 3 — Cron / background / idempotency (facts.md §Cron)

| Fact | Job / file | Case | Mode | Tier | Target file | Status |
|------|-----------|------|------|------|-------------|--------|
| Each QStash job retry/timeout + idempotent | webhook.process, ocr.process, ksef.sync, google-workspace.sync, peppol.outbound/inbound/poll, late-interest pdf, zatca.submit, outbox.drain | idempotent on redelivery | auto | 3 | `idempotency.test.ts` + `webhooks/drain.test.ts` | pending |
| Outbox exactly-once | enqueue in business tx; drain dedupe | redrained id deduped | auto | 2/3 | `idempotency.test.ts` | pending |
| Cron handlers `createCronLogger`, validate CRON_SECRET/QStash sig | token-refresh, exchange-rates, boe-rate-poll, trial-notifications, reminders, inpost-status-poll, data-purge, classification jobs, job-health | no `console.*`; sig validated before execute | auto | 1/3 | `cron-auth.security.test.ts` | pending |
| Token-refresh renews all providers | unrefreshable conn | flagged not silently dropped | mock-only | 3 | `adapters/token-refresh.test.ts` | gap |

---

## Tier 1 — public-api (Hono REST) (facts.md §public-api)

| Fact | Endpoint | Case | Mode | Tier | Target file | Status |
|------|----------|------|------|------|-------------|--------|
| Only `co_live_*` ENTERPRISE key; reject missing/invalid/under-tier | all `/api/v1/*` | 401/403 | auto | 1 | extend `rate-limit.security.test.ts` / `public-api-auth.security.test.ts` | baseline+ext |
| Org-scoped from key, no cross-org | contractors/invoices/contracts/documents | no foreign-org read/write | auto | 1 | `public-api-auth.security.test.ts` | pending |
| Schema-validated, 4xx not 5xx | malformed body/param | 4xx | auto | 1/4 | `public-api-auth.security.test.ts` | pending |
| `module.public-api` + `module.outbound-webhooks` gate | off → unavailable | NOT_FOUND/disabled | auto | 1 | `flag-gating.security.test.ts` / public-api test | pending |

---

## Baseline (Step 0) — red/green ground truth

Scoped runs on `audit/post-migration-parity`, 2026-06-16. Ground truth (no handoff trusted). The Apr "16 files / ~51 fails" handoff is **stale** — the real number is 18 files / 35 fails, all in `@contractor-ops/api`, and security is clean.

| Suite | Total | Passed | Failed | Verdict |
|-------|------:|-------:|-------:|---------|
| `@contractor-ops/api` (full) | 3640 | 3587 | **35** (18 files) | RED — mostly post-migration mock-drift |
| `@contractor-ops/api` security subset | 60 | 60 | 0 | **GREEN** |
| `@contractor-ops/integrations` | 537 | 530 | 0 | GREEN (1 non-assertion teardown error*) |
| `@contractor-ops/feature-flags` | 122 | 122 | 0 | GREEN |
| `@contractor-ops/public-api` | 117 | 117 | 0 | GREEN |

\* integrations non-zero exit is a single `EnvironmentTeardownError` (`@date-fns/tz` import from `idp-saga/cooldown.ts` resolving after teardown, surfaced via `ocr-service.test.ts`) — infra/teardown race, every assertion passes.

**The 18 RED api files (pre-existing, NOT introduced here):** `onboarding-import` (8), `errors-i18n-parity` (5), `compliance-override-mutation` (3), `organization` (2), `jira` (2), `integration` (2), `compliance-item-audit-trail` (2), `classification-supersession` (2), `jira-webhook-handler` (1), `approval-engine-operator-registry` (1), `workflow-override-blocking-task` (1), `time` (1), `teams` (1), `peppol` (1), `linear` (1), `feature-flags` (1, file-level), `classification-flag-coverage` (1), `idp-impact-preview` (1).

Dominant cause = tests asserting pre-migration call shapes (org-scoping added to `where`, `completedAt` timestamps added to update payloads, `requireTier(PRO)` added to integration routers, cursor-pagination shape). Two warrant a real-bug look, not blind quarantine: **`errors-i18n-parity`** (genuine en/de/pl/ar translation-key gaps) and **`classification-flag-coverage`** (static source-structure guard — `classification.ts` import drift). This audit added **zero** new red; all 238 new tests pass green.

---

## New tests added by this goal (test-only, wiki-exempt)

| # | File | Tier | Fact(s) | Tests | Status |
|---|------|------|---------|-------|--------|
| 1 | `packages/auth/src/__tests__/role-permission-matrix.test.ts` | 1 | Authz §12 (full 9-role × resource exact set) | 123 | ✅ pass |
| 2 | `packages/api/src/__tests__/security/tenant-status-rejection.security.test.ts` | 1 | Auth §7 (+§4/§11 admission) | 6 | ✅ pass |
| 3 | `packages/api/src/__tests__/security/portal-idor.security.test.ts` | 1 | IDOR §21 (portal invoice/contract/equipment cross-read) | 11 | ✅ pass |
| 4 | `packages/integrations/src/adapters/__tests__/calendar-deterministic-event-id.test.ts` | 3 | Integrations-out §59 (deterministic event id → no-op upsert) | 8 | ✅ pass |
| 5 | `packages/api/src/services/__tests__/audit-writer-fields.test.ts` | 2 | Audit §25/§27 (ip/userAgent/action capture + same-tx routing + append-only guards) | 9 | ✅ pass |
| 6 | `packages/api/src/__tests__/security/portal-upload-mime.security.test.ts` | 4 | Uploads §95 (portal invoice server-side MIME gate) | 3 | ✅ pass |
| 7 | `packages/auth/src/__tests__/auth-lockout-ratelimit.test.ts` | 1 | Auth §2/§3 (5-fail lockout, sign-in rate-limit, Turnstile gate) | 10 | ✅ pass |
| 8 | `packages/auth/src/__tests__/session-membership-org.test.ts` | 1 | Auth §4/§11 (disabled-member session block, no-org → onboarding seed) | 7 | ✅ pass |
| 9 | `packages/api/src/__tests__/audit-mutation-coverage.test.ts` | 1/2 | Audit §27/§28 (audit-row presence per sensitive mutation + same-tx; locks the no-audit code-gaps) | 16 | ✅ pass |
| 10 | `packages/api/src/routers/portal/__tests__/tax-form-w8bene.test.ts` | 4 | Forms §108 (W-8BEN-E entity branch + perjury/typed-name + supersede) | 10 | ✅ pass |
| 11 | `packages/integrations/src/adapters/__tests__/deprovision-idempotency.test.ts` | 2/3 | Integrations-out §64 (provider-state dedupe; pins unary adapter signature) | 4 | ✅ pass |
| 12 | `packages/integrations/src/adapters/__tests__/idempotency-header-mapping.test.ts` | 2/3 | Integrations-out §58 (per-provider idempotency-header mapping) | 6 | ✅ pass |
| 13 | `packages/api/src/services/__tests__/queue-retry-config.test.ts` | 2/3 | Integrations-out §63 (`peppol.outbound` retries=5, inbound/poll=3) | 3 | ✅ pass |
| 14 | `apps/api/src/__tests__/process-webhook.test.ts` (extended) | 3 | Webhooks §72 (handler-throw → FAILED + retry, CAS re-claim) + un-bricked a pre-existing broken mock | +2 (→10) | ✅ pass |
| 15 | `apps/web-vite/src/components/settings/__tests__/revoke-api-key-dialog.test.tsx` | 4 | Forms §109 (destructive confirm-gate) | 5 | ✅ pass |
| 16 | `apps/web-vite/src/components/admin/boe-rate/__tests__/delete-boe-rate-dialog.test.tsx` | 4 | Forms §109 (destructive confirm-gate) | 5 | ✅ pass |
| 17 | `apps/web-vite/src/components/settings/e-invoicing/__tests__/leitweg-id-delete-dialog.test.tsx` | 4 | Forms §109 (destructive confirm-gate) | 5 | ✅ pass |
| 18 | `apps/web-vite/src/components/settings/e-invoicing/__tests__/peppol-participant-deregister-dialog.test.tsx` | 4 | Forms §109 (destructive confirm-gate) | 5 | ✅ pass |

**Total: 238 new passing tests across all four risk tiers** (160 first pass + 78 from the parallel gap-closure fan-out). Each closes a genuine **GAP**/PARTIAL the coverage audit found — never a duplicate. They extend, never duplicate, the 6 baseline `*.security.test.ts`. Zero regression: the api `security` dir went 6→9 files (60→80 tests) all green; full auth suite 218 green.

Scoped verify (representative):
```bash
pnpm --filter @contractor-ops/auth test src/__tests__/                                          # incl. lockout, session-membership, role-matrix
pnpm --filter @contractor-ops/api test src/__tests__/security src/__tests__/audit-mutation-coverage.test.ts src/routers/portal/__tests__/tax-form-w8bene.test.ts
pnpm --filter @contractor-ops/integrations test src/adapters/__tests__/deprovision-idempotency.test.ts src/adapters/__tests__/idempotency-header-mapping.test.ts
pnpm --filter @contractor-ops/api-server test src/__tests__/process-webhook.test.ts
pnpm --filter @contractor-ops/web-vite test <single-dialog-path>   # one path at a time — never unscoped (RAM)
```

---

## Coverage reality & Findings list (Step 6 close-out)

**Headline:** the codebase is already ~95% covered (~350 test files). The QA pass's value was an exhaustive **coverage audit** that separated genuine gaps from already-covered surfaces, then **closed every genuine test gap** across all four tiers (238 new passing tests) and **confirmed the residual gaps that are product code-gaps** — behaviors that don't exist yet, so no test can pass for them (need source change + wiki). Those are enumerated below with file:line + fix sketch, never silent.

### Hypothesis corrections (supersede the `NOT_FOUND` wording in the flag-gating rows above)
- **Flag gates throw `FORBIDDEN`, not `NOT_FOUND`.** The real dedicated gates (`require-classification-flag` → `CLASSIFICATION_ENGINE_DISABLED`; `require-us-expansion-flag`) throw FORBIDDEN. NOT_FOUND is only the generic `requireFeatureFlag` middleware, which in production wraps only `payments.*`/`gulf.*` — none of the nine module flags. Covered by `tax-form-staff.test.ts`, `portal/tax-form.test.ts`, `classification-flag-coverage.test.ts`, `evaluator.test.ts`.
- **Portal cookie lifetime is ~7 days, not 24h** (per `services/portal-session.test.ts`) — facts.md §Auth bullet 8 overstates 24h; HMAC tamper/expiry rejection itself is covered.

### CODE gaps (not test gaps — require a product change + wiki update; confirmed by source read)
- **`killswitch.ai-invoice-parser` is never consumed in the OCR path.** Declared `flags-core.ts:76` (`default:true`, `killWhenUnknown:true`); zero consumers. `apps/api/src/routes/ocr.ts:69` → `ocr-extraction.ts:111` `extractInvoice` → `ocr-service.ts:79` runs Claude Vision unconditionally — no flag check, no store-without-OCR/manual fallback (Uploads §99 behavior **does not exist**). Fix: gate `extractInvoice` on `evaluate('killswitch.ai-invoice-parser', {organizationId, region})`.
- **AuditLog DB-level append-only is WEAKER than "missing" — it's actively permissive.** No trigger/REVOKE; the only DB guard is RLS policy `auditlog_write` (`20260512000000_baseline/migration.sql:4796`) declared **`FOR ALL`** with check `org_match AND can_write_ops` — i.e. it covers UPDATE/DELETE and is **not** insert-only, so any org-writer session can mutate/delete existing audit rows at the DB layer. Append-only is enforced *only* at the app layer (`audit-writer.ts` narrows the client to `create`/`createMany`). Fix: replace with `FOR INSERT WITH CHECK (...)` (no UPDATE/DELETE policy → RLS deny) and/or a `BEFORE UPDATE OR DELETE … RAISE EXCEPTION` trigger + `REVOKE UPDATE, DELETE`.
- **Mutations that write NO audit row** (locked by `audit-mutation-coverage.test.ts` so a future fix is test-visible): `reassessmentTrigger.acknowledge`/`dismiss` (`reassessment-trigger.ts:89`), `portal.updateContactInfo` (`portal-profile-router.ts:141`), core approval `approve`/`reject` (`approval-queue.ts:205` — persists `ApprovalDecision` but no shared-writer `AuditLog`). Audit §27/§28 — real coverage gaps in the product, not the tests.
- **Deprovision adapters set no idempotency header** for Okta / Slack / Google-Workspace (DocuSign/Storecove/Entra/Outlook do). Adapter-level dedupe is provider-state-based (404→`LIKELY_GONE`, PATCH last-write-wins); the real `(orgId, idempotencyKey)` dedupe is the `DeprovisioningRun @@unique` index + P2002 at the tRPC layer — not the adapter. Pinned by `deprovision-idempotency.test.ts`.

### CODE gaps — REFUTED on inspection (earlier matrix claim was wrong)
- **`module.public-api` / `module.outbound-webhooks` gating** — those flag keys **do not exist** in the registry (`flags-core.ts`). There is no declared flag being ignored, so this is not an "unenforced flag" gap. The public-api surface IS gated — per-route Bearer/API-key auth + ENTERPRISE-tier + prod CORS allowlist (`app.ts:84`) + rate-limit. A module-level kill-switch would be a *new feature request*, not a bug. (facts.md §public-api bullet 4 / Flags §87 overstate these as existing flags.)

### Test gaps — now FILLED by the parallel gap-closure fan-out
Every documented test gap was closed with a passing test (files 7–18 above) or confirmed a code-gap (locked above):
- ✅ **Auth brute-force / bot** — lockout (5/15min, locked-rejection-with-correct-creds), sign-in/sign-up rate-limit rules, Turnstile FORBIDDEN gate, disabled-member session block (create+update), no-org → onboarding seed. All exercise the **real** Better Auth config hooks (`config.ts:293–494`), not config-only.
- ✅ **Audit-on-mutation** — member deactivate/reactivate, settings update, api-key create/revoke, payment lock+export (same-tx), portal return/cancel (same-tx) asserted; org `update`/`delete` confirmed **non-existent procedures** (Better Auth handles org writes); the no-audit mutations locked as code-gaps.
- ✅ **Deprovisioning dedupe / header mapping** — provider-state dedupe + unary signature pinned; per-provider header mapping asserted (DocuSign/Storecove/Entra/Outlook/Google-id); Okta/Slack/GWS no-header recorded.
- ✅ **`peppol.outbound retries:5`** — asserted via the production `enqueueJob`/`publishJSON` seam (+inbound/poll=3).
- ✅ **Webhook handler-throw → FAILED + retry** — `_process` drain throw→FAILED+HTTP500 (QStash retry signal) + CAS re-claim of a FAILED row.
- ✅ **W-8BEN-E entity branch** — LOB/treaty-article capture, perjury/typed-name Zod gate, supersession, FORBIDDEN-when-flag-off.
- ✅ **Destructive-dialog confirm** — revoke-API-key / delete-BOE-rate / delete-Leitweg-ID / PEPPOL-deregister: mutation fires only on explicit confirm, never on render/cancel.

Residual **manual-only**: contractor/contract wizard state-hooks + wizard back-nav state-preservation (RTL), RTL (ar) visual, real-OCR accuracy, live-provider sandbox.

### 18 baseline-red api files — classified (verified by re-run + source read, NOT blind-quarantined)
**No serious source regression.** Net actionable source bugs = 2 (both small). Breakdown:
- **REAL BUG (product, fix needed):** `errors-i18n-parity` (5) — `contractorInvalidEin` is thrown live (`contractor-tax.ts:39`) but missing from **all 4** locale bundles → user sees the raw key; `taxFormNotFound` is an orphaned locale key with no `errors.ts` export. `onboarding-import` carries **1** real bug — `mergeByEmail` returns first-seen casing, violating its lowercase contract (`onboarding-import-service.ts:74,86,119`); its other 7 fails are drift.
- **DRIFT (source correct, test asserts stale shape):** `integration`, `time`, `peppol` (cursor = last-kept-row convention, test expects old extra-row cursor), `classification-supersession` (feature added `uk.ip_assignment@v1`/`de.werkvertrag_ip@v1` rows; test pins pre-feature counts).
- **NEEDS-FIX (test must adopt the new *correct* shape):** `compliance-override-mutation` + `compliance-item-audit-trail` (procedures moved `classification.*` → `complianceAdmin.*`), `jira`/`teams`/`linear` (tier-gating refactored to `integrationProcedure({tier:'PRO'})` factory; static guards assert old import), `organization` (return shape +1 field), `jira-webhook-handler` (`completedAt` now set), `approval-engine-operator-registry` (where now org-scoped — *more* correct), `workflow-override-blocking-task` (extra recompute `update` shifts call index), `feature-flags` (file-level: mock omits `evaluate`, now called at module load via us-expansion), `classification-flag-coverage` (guard should point at the new sub-router barrel; flag gating intact), `idp-impact-preview` (mock missing the new `createConfiguredDeprovisionableAdapter` factory).

**Quarantine decision:** left as-is + reported (per plan's open-question recommendation) — fixing them is a separate "post-migration test re-sync" task (mostly mechanical: adopt new shapes, add 2 mock exports), plus the 2 real product fixes (missing i18n strings, `mergeByEmail` casing). No new red is attributable to this audit.

### Manual-only (marked, never silent)
RTL (ar) visual correctness across surfaces, real-OCR extraction accuracy, live-provider sandbox round-trips (`RUN_LIVE_SMOKE=1`, out of scope), notification email de/ar content + `dir`, and role-gated UI button hide/disable — all stay manual.

---

## Resolution — product fixes applied (parallel fan-out)

The code-gaps and real bugs above were then FIXED across parallel agents. Each is source + matching wiki (documentation-follows-code) + tests.

| Fix | Change | Verify |
|-----|--------|--------|
| **AuditLog DB append-only** | New migration `20260617000000_auditlog_append_only`: `auditlog_write FOR ALL` → INSERT-only policy + `BEFORE UPDATE` reject-trigger + DELETE gated on `allowAuditPurge(tx)` (new `packages/db/src/rls.ts` helper). GDPR erasure (`gdpr.ts`) opts in before its audit delete — purge preserved, ordinary writers cannot mutate/delete audit rows. | db append-only + rls + gdpr: 13 + 8 green |
| **Missing audit writes** | `reassessment.acknowledge/dismiss`, `portal.contact.update`, `approval.approve/reject` now emit same-tx `writeAuditLog`. Lock test flipped to assert-present. | audit-mutation-coverage 17 + routers 70 green |
| **killswitch-OCR wiring** | `ocr-extraction.ts` gates Claude Vision on `evaluate('killswitch.ai-invoice-parser')`; off → skip AI, persist upload, FAILED/manual-entry fallback. | ocr-extraction 8 green |
| **2 real red-file bugs** | `mergeByEmail` lowercase-normalizes output (contract: dedup + match are case-insensitive); 15 genuinely-missing `Errors.*` strings added across en/de/pl/ar; `taxFormNotFound`/`taxFormNotDraft` allowlisted (UI-only, thrown nowhere). | errors-i18n-parity + onboarding-import green |
| **16 drift test files** | Re-synced to current correct shapes (cursor=last-kept, `complianceAdmin.*` moves, `integrationProcedure({tier})` factory, `completedAt`, org-scoped where, `evaluate`/factory mock exports). | 16 files / 195 green |

**Idempotency headers (Okta/Slack/GWS): REFUTED, not fixed** — those provider APIs have no client-set idempotency/correlation header; re-run safety is provider-state-based. Pinned by a negative-assertion test rather than inventing a header.

### Final regression gate
- **Build:** `@contractor-ops/integrations` build exit 0, `pnpm typecheck --filter=@contractor-ops/api` 14/14. (Fixed a build break this session introduced: a deep cross-package `einvoice` import in the integrations idempotency-header test — relocated the Storecove assertion to the einvoice package.)
- **Tests:** full api suite **0 failed assertions**; 24 baseline-red files → **6 residual**, all pre-existing **Wave-0 RED** TDD scaffolds (`tin-match.service`, `form-1099-nec`, `iris-ack-parser`, `tax-filing-transmitter`, …) importing modules that never existed in git — untouched by this work. Two regressions this session introduced (`mergeByEmail` unit test, `portal.test.ts` updateContactInfo) were found and fixed.
- **Docs:** 12 wiki pages + `.planning/MEMORY.md` invariant + `wiki/log.md`/`hot.md`/BM25; `pnpm check:wiki-brain` → 0 errors. (Reverted an out-of-scope 142-line rewrite of the gate script a doc agent bundled in; the original gate passes clean.)
- **Pre-existing debt (NOT this work):** `pnpm lint:no-breadcrumbs` fails only in the 6 Wave-0 files (breadcrumb IDs `US-FORM-03`/`D-11`/…); same files break import. A separate cleanup.
