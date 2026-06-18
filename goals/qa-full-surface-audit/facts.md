# Facts — QA Full Surface Audit

> Each bullet is one testable, verifiable QA fact (automated or manual). The QA pass produces (1) a test matrix doc instantiating these facts per surface, then (2) an automated suite for the highest-risk gaps. Risk order: **security/auth/IDOR → money/data integrity → integration correctness → input/UX**.

## Scope & approach

- In scope: `apps/web-vite` (staff SPA), portal (external), `apps/api` + `packages/api` (tRPC staff + portal routers), `apps/public-api` (Hono REST), `apps/cron-worker` (jobs/QStash/webhooks).
- Out of scope: `apps/landing` (marketing), `apps/cms` (Payload CMS).
- All external HTTP is mocked; tests use no live credentials and make no real third-party calls. Webhook/signature tests use recorded fixtures.
- A surface counts as "covered" only when happy path + at least one rejection/edge path + one auth/role path (where applicable) are exercised.
- Existing `*.security.test.ts` regression suite (53 tests) is the baseline; new security tests extend it, do not duplicate it.

## Auth & session

- Email+password sign-up requires email verification before a session grants tenant access (`requireEmailVerification: true`).
- 5 failed sign-in attempts lock the account for 15 minutes; the 6th attempt is rejected even with correct credentials during the lock window.
- Sign-in is rate-limited to 10/min per IP; sign-up is rate-limited and requires a valid Turnstile CAPTCHA token.
- A session for a member whose `Member.disabledAt` is set cannot be created or refreshed (disabled member is locked out immediately).
- Google OAuth auto-account-link only succeeds for a verified email; Microsoft auto-link is rejected (self-asserted consumer-tenant email).
- Organization `dataRegion` is set once at creation from `billingCountry` and is immutable afterward (US opt-in, default EU).
- A request whose org status is SUSPENDED or ARCHIVED is rejected by `tenantMiddleware` (only ACTIVE orgs resolve).
- Portal sessions use the HMAC-signed `portal_session` cookie with 24h expiry; a tampered or expired portal cookie is rejected by `portalAuthMiddleware`.
- API-key auth accepts only `co_live_*` Bearer tokens that are non-revoked, non-expired, and tied to an ACTIVE org; revoked/expired keys are rejected.
- Sensitive actions (role change, member deactivation, payment-run ops) require session freshness ≤5min via `sensitiveActionMiddleware`; a stale session is rejected.
- A new user with no organization is routed to org onboarding and never triggers a `tenantNoActiveOrganization` throw.

## Authorization & roles

- Each of the 9 org roles (owner, admin, finance_admin, ops_manager, team_manager, legal_compliance_viewer, it_admin, external_accountant, readonly) grants exactly its documented permission set and nothing more.
- `contractorPii: read` (SSN/PII reveal) is granted only to owner/admin/finance_admin; all other roles are denied the reveal.
- A role lacking a required permission receives FORBIDDEN from `requirePermission`, for both session auth and API-key (scope) auth.
- Role changes take effect on the next tRPC call with no cookie-cache delay (permission re-read every call).
- `platform_operator` (global) can read/write `admin:boe-rate` cross-tenant reference data and cannot access any per-org resource.
- `requireTier` gates procedures by subscription level (STARTER/PRO/ENTERPRISE); an under-tier caller is rejected.
- `requireAddOn` gates entitlement-specific procedures (e.g., workforce, us-cross-border); a caller without the add-on is rejected.
- Demo-mode orgs are blocked from mutations unless the procedure is tagged `.meta({allowInDemo: true})`.
- Role-gated UI: action buttons (Add Contractor, Deactivate, Create API Key, workflow-role CRUD, etc.) are hidden/disabled when the role lacks the permission, not merely server-rejected.

## Tenant isolation & IDOR

- Every staff query/mutation is org-scoped via the tenant Prisma extension; a record from another organization is never returned or mutated.
- Write transactions issue `SET LOCAL app.org_id` (RLS scaffolding); high-blast-radius reads (Document/Invoice/Contractor/ApprovalStep/Notification) run through `withRlsReads`.
- Portal procedures return only rows where `contractorId` matches the session; a contractor cannot read another contractor's invoice/contract/equipment/profile/tax-form by supplying a foreign id.
- API keys are scoped to the org resolved from the key, never from client-supplied org input.
- Document download URLs are server-presigned and contain no org id in the body; an expired/invalid presigned URL is rejected.
- Staff `getInvoice(id)`/`getContract(id)` reject ids belonging to another org (org scope) — intra-org contractor-ownership behavior is documented and tested as designed.

## Audit

- `writeAuditLog` records org id, actor type/id/name, action, resource type/id/name, old/new value JSON, ip, and user agent for every audited mutation.
- AuditLog rows are append-only; UPDATE/DELETE against them is rejected.
- Sensitive mutations write an audit entry inside the same transaction as the business change (passed `tx`): contract amend/bulk, approval decisions, portal W-form submit, profile update, equipment return/shipment, reassessment ack/dismiss.
- Audit coverage gaps are explicitly verified (pass or documented gap): member deactivate/reactivate, organization update/delete, payment-run export/lock, settings update, API-key create/revoke.
- Audit `export` (CSV) is gated to settings:read and returns only the caller's org rows.

## Integrations — outgoing

- Each outbound provider call (DocuSign, Autenti, Google/Outlook Calendar, Storecove/PEPPOL, Resend, KSeF, ZATCA) sends a stable idempotency key derived as `sha256(orgId:operation:businessKey)`; a retried call with the same business key does not double-execute.
- Calendar adapters derive deterministic event ids (Google base32hex, Outlook RFC-4122 v5) so re-issuing the same event is a no-op upsert.
- DocuSign/Autenti e-sign create envelope → embedded signing URL → signed-document retrieval → void/resend each map to the documented adapter method and surface errors (no silent failure).
- Payment export produces the correct format per destination: CSV, Elixir/Plux (PL), SEPA_XML, SWIFT_XML, BACS_STD18 — each validates against its format spec.
- Payment-run export performs the atomic DRAFT/LOCKED→EXPORTED transition once; a duplicate export with the same `idempotencyKey` is rejected/deduped.
- PEPPOL outbound and ZATCA submit enqueue with idempotency and retry (peppol.outbound retries 5, zatca.submit retries 3) and record transmission state.
- Outbound deprovisioning (Entra/Okta/GitHub/Google Workspace/Slack) runs are deduped by `(organizationId, idempotencyKey)`; a re-run with the same key does not repeat side effects.

## Integrations — inbound webhooks

- Each HMAC provider (Slack, Jira `X-Hub-Signature`, Linear `linear-signature`, Autenti, InPost, Storecove, Stripe, DocuSign per-connection secret) rejects a payload whose signature is missing or invalid.
- Notion/Confluence receivers (schema-only, no signature) reject payloads that fail Zod validation.
- The QStash drain (`/webhooks/_process`) verifies the Upstash HMAC and atomically claims the `WebhookDelivery` row (RECEIVED→PROCESSING→PROCESSED/FAILED); a replayed delivery is not processed twice.
- Stripe events are deduped via `StripeEvent.processedAt`; a redelivered event id is ignored.
- A webhook whose handler throws is marked FAILED and retried up to its configured retry count, not lost.

## Notifications & email

- `notification-service.dispatch` always creates a `Notification` row and is deduped by `(organizationId, dedupKey)`; a duplicate event does not create a second notification.
- Email send (Resend) carries an `Idempotency-Key` (sha256 of from|to|subject|body or OutboxEvent.id); a resend within the dedup window does not deliver twice.
- Email failure, Slack failure, or Teams failure inside dispatch is caught and non-fatal (the in-app notification still persists).
- Notification email templates render localized subject+body for en, pl, de, ar (RTL for ar).
- In-app notification UI shows loading (skeletons), empty, and populated states; mark-as-read and mark-all-read update state correctly.
- Notification preferences (org-level and contractor portal) gate which channels fire.

## Feature flags & jurisdiction

- Flags resolve only through `@contractor-ops/feature-flags` (`evaluate`/`useFlag`/`<Feature>`); no app code calls the Unleash SDK directly.
- A flag with `jurisdiction: 'EU'` returns false for an ME org and vice-versa, regardless of Unleash state (evaluator short-circuit).
- Every module flag (classification-engine, us-expansion, workforce-employees, public-api, outbound-webhooks, iris-efile, idp-deprovisioning-gws/slack, legal-approval) defaults false and hides both its UI surface and its gated tRPC namespace when off.
- `module.classification-engine` off (or any disclaimer PENDING) hides IR35/Scheinselbständigkeit UI and the classification namespaces; the kill-switch overrides Unleash when a disclaimer is pending.
- `module.us-expansion` off makes the staff `taxForm` namespace and portal W-form wizard return NOT_FOUND / hidden; on, they resolve.
- `killswitch.ai-invoice-parser` forces OFF on Unleash outage (`killWhenUnknown: true`), disabling Claude Vision OCR.
- Each flag-gated procedure throws the documented error (NOT_FOUND) when its flag is off, verified per gated namespace.

## Uploads

- Each upload entry point accepts only its documented MIME/extension set and rejects others with a validation error: bank statement (CSV/OFX/MT940/PDF), contractor/contract/cost-center import (CSV/XLSX ≤10MB), e-invoice intake (PDF/XRechnung XML), portal invoice (PDF/JPG/PNG), tax-form doc (PDF/image), compliance doc, branding logo (PNG/JPG/SVG).
- Oversized uploads (>10MB where capped) are rejected before parsing.
- Bank-statement parser correctly extracts transactions from each supported format and surfaces a parse error (not a crash) on malformed input.
- Upload endpoints are rate-limited (`upload-rate-limit`); excess uploads are throttled.
- Portal/staff OCR uploads honor `killswitch.ai-invoice-parser` — when off, the file is stored without OCR and the UI reflects manual-entry fallback.
- A malformed/empty/oversized/wrong-type CSV in the import wizard fails at validation with row-level feedback, not a partial commit.

## Forms, modals, wizards (input validation)

- Every form blocks submit and shows field-level errors when a required field is empty or malformed; no silent failure and no 500 reaches the user.
- Every tRPC procedure validates input with Zod; a payload failing the schema returns a typed validation error, not an unhandled exception.
- Boundary inputs are rejected/handled correctly: negative/zero amounts (budget must be positive), future/past date bounds, invalid NIP/VAT-EU, invalid IBAN/bank account, over-long strings, unicode/RTL text, and injection-style payloads (XSS/SQL) are neutralized.
- Multi-step wizards (contractor 3-step, contract 2-step, import 5-step, tax-form 4-step, org onboarding) preserve state across back/next, block advancing on invalid steps, and only commit on the final confirm.
- The tax-form wizard branches correctly to W-9 / W-8BEN / W-8BEN-E from the determination step and enforces the perjury checkbox + typed-name match before submit.
- Destructive-action dialogs (revoke API key, deactivate member, void envelope, delete BOE rate, delete Leitweg-ID, PEPPOL deregister) require explicit confirmation before firing.
- Import-wizard duplicate handling (merge/skip) resolves deterministically and never creates duplicate records on re-run.
- Jurisdiction/flag-gated forms appear only for the correct region+flag (BACS UK-GBP, Skonto DE, e-invoice intake EU, Saudization ME, W-form US).

## UI states

- Every wired section renders distinct loading (skeleton), empty, and error states; a failed query shows an error banner with retry, not a blank screen.
- The web-vite data-layer rules hold: pages stay thin composers, sections branch states via hooks, and `pnpm check:web-vite-data-layer` / `check:web-vite-page-shells` / `check:web-vite-presentational` pass.
- RTL (ar) renders correctly across major surfaces with no clipped/mirrored layout breaks.
- Toasts fire the correct success/error key for each mutation (12 common toast keys + per-domain).

## Cron / background / idempotency

- Each QStash job (webhook.process, ocr.process, ksef.sync, google-workspace.sync, peppol.outbound/inbound/poll, late-interest.render-claim-pdf, zatca.submit, outbox.drain) runs under its documented retry/timeout and is idempotent on redelivery.
- The transactional outbox enqueues events inside the business tx and drains them exactly once via `outbox.drain`; a redrained event id is deduped.
- Cron-worker handlers (token-refresh, exchange-rates, boe-rate-poll, trial-notifications, reminders, inpost-status-poll, data-purge, classification jobs, job-health) run with `createCronLogger` (no `console.*`) and validate the `CRON_SECRET`/QStash signature before executing.
- Token-refresh renews OAuth tokens for every connected provider; an unrefreshable/expired connection is flagged, not silently dropped.

## public-api (Hono REST)

- The REST surface authenticates only valid `co_live_*` API keys at ENTERPRISE tier and rejects missing/invalid/under-tier keys.
- Every REST endpoint is org-scoped from the key and cannot read/write another org's data.
- REST inputs are schema-validated; malformed bodies/params return 4xx, not 5xx.
- `module.public-api` and `module.outbound-webhooks` gate the REST + webhook-emit surfaces; off → unavailable.
