# Phase 75: F4 Offboarding — Contract Health Check + IP Verification + Credential Vault - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Three intertwined offboarding-hardening capabilities, all gated by the `offboarding-ip-clause-scanner` PENDING feature flag and the legal-sensitive Standing Constraint:

1. **Contract health-check engine** — On every `Contract` upload (and admin-triggered re-runs), a fire-and-forget QStash background job calls the existing v2.0 `ClaudeOcrAdapter` with a new `contract-health-tools.ts` tool_use schema. Each run is an independent, snapshotted `ContractHealthCheckRun` row capturing verdict, cited clauses, model version, content hash. `Contract.complianceFlagsJson` always points to the latest run.
2. **IP_VERIFICATION hard-block + e-sign hand-off** — `WorkflowRun.completedAt` cannot be set while the `IP_VERIFICATION` task is open. Admin signs the IP-ratification document via existing v2.0 e-sign adapters: DocuSign (UK/PL/US/KSA/UAE), Autenti (DE). On `signing.completed` webhook, the workflow task auto-completes and the `ContractorComplianceItem` flips SATISFIED via Phase 71 D-12 documentType carry-forward. OWNER-only override path reuses Phase 74 D-09..D-12 verbatim.
3. **CredentialReference vault-pointer schema + secret-paste rejection** — Standalone `CredentialReference` table linked to `OffboardingRecord` with structured fields (label, vaultProvider enum, vaultUrl, accessType enum, successorUserId, status). Validators-package secret-shape detector rejects strings shaped like real secrets (AKIA*, GitHub PAT, JWT, hex≥32, etc.) at every input field. System stores POINTERS only, NEVER secrets.

Phase 75 also extends the Phase 73 locked-phrase registry with new per-jurisdiction `legal/ip-clauses-{jurisdiction}.ts` modules including the DE Werkvertrag Schöpferprinzip + Nutzungsrechte distinction (§7 UrhG). All new entries land PENDING per Phase 70 D-09 — production deploy gate is APPROVED-by-legal.

Out of scope: schema-level changes to existing `Document` model semantics, e-sign adapter changes (Phase 75 only ROUTES; v2.0 DocuSign + Autenti adapters already exist), Phase 76 IdP deprovisioning saga (depends on Phase 75 finalising the access-revoke task hook). Legal verification of every new IP-clause phrase + Werkvertrag wording is DEFERRED per Standing Constraint.

</domain>

<decisions>
## Implementation Decisions

### Health-check engine — trigger, idempotency, model version

- **D-01:** Health-check trigger is a QStash background job. `Contract.create` mutation enqueues `contract-health-check` job (existing QStash infrastructure used by v3.0 IdP adapters + v5 economic-dependency cron). Job: read contract bytes from R2 → call `ClaudeOcrAdapter` with new `contract-health-tools.ts` tool_use schema → persist results. Fire-and-forget; admin sees "Health-check running…" status badge until persisted. Honours ROADMAP "60s SLA" naturally; QStash retries on transient Anthropic API failures with exponential back-off.
- **D-02:** Versioned per-run history table `ContractHealthCheckRun`:
  ```
  id              String   @id @default(cuid())
  contractId      String
  contentHash     String   // SHA-256 of contract PDF bytes at run time
  modelVer        String   // typed-const value at run time, e.g. 'claude-opus-4-7'
  verdict         IpAssignmentVerdict  // LIKELY_PRESENT | LIKELY_MISSING | MANUAL_REVIEW_REQUIRED
  resultsJson     Json     // full structured payload per D-05
  status          RunStatus  // PENDING | SUCCEEDED | FAILED
  errorMessage    String?
  startedAt       DateTime @default(now())
  completedAt     DateTime?
  triggeredBy     RunTrigger  // UPLOAD | MANUAL | MODEL_BUMP_BULK
  triggeredByUserId String?

  @@index([contractId, startedAt(sort: Desc)])
  @@index([status])
  @@unique([contractId, contentHash, modelVer], where: { status: 'SUCCEEDED' })  // dedup guard
  ```
  `Contract.latestHealthCheckRunId String?` points to the latest SUCCEEDED row; `Contract.complianceFlagsJson` is a denormalised mirror of `latestHealthCheckRun.resultsJson` for query performance (Phase 73 dashboard reads it directly).
- **D-03:** Idempotency via partial-unique-index on `(contractId, contentHash, modelVer) WHERE status = 'SUCCEEDED'`. Re-clicking "Re-run" within 24h with no content/model change is a no-op (returns the existing row). Manual re-run button can pass `force: true` to bypass the dedup window (creates a new row even if `(contentHash, modelVer)` matches — used when admin suspects a transient model output difference).
- **D-04:** Model version is a typed-const `CONTRACT_HEALTH_MODEL_VER = 'claude-opus-4-7' as const` in new file `packages/api/src/services/contract-health/model.ts`. Code only ever reads the const; no env var, no per-org config. When developers bump the const in a PR, a follow-up PR ships an idempotent admin script `packages/api/scripts/bulk-rerun-contract-health.ts` that admins trigger via Settings > Compliance > "Re-run all contract health-checks". Mirrors Phase 70 D-02 typed-constants philosophy. Mirrors Phase 71 D-03 `POLICY_RULE_SET_VERSION` snapshot-on-write pattern.
- **D-05:** Manual re-run UX: TWO surfaces, ONE shared mutation `contract.rerunHealthCheck(contractIds: string[], opts: { force?: boolean })`:
  - **Per-contract:** "Re-run health check" button on the Contract detail page (next to the existing version-history actions).
  - **Bulk:** Bulk action on the org-level Contracts list (admin selects via checkbox → "Re-run health check on N contracts" → confirm modal showing affected count). Mirrors Phase 71 D-13 per-contractor + bulk recompute UX pattern.

### Verdict shape + ContractorComplianceItem creation + e-sign hand-off

- **D-06:** `ContractHealthCheckRun.resultsJson` (and the denormalised `Contract.complianceFlagsJson`) shape:
  ```ts
  {
    version: 1,
    ipAssignment: {
      verdict: 'LIKELY_PRESENT' | 'LIKELY_MISSING' | 'MANUAL_REVIEW_REQUIRED',
      citedClauses: Array<{
        phraseId: string,             // e.g. 'uk.hereby_assigns@v1'
        jurisdiction: 'UK' | 'DE' | 'PL' | 'KSA' | 'UAE' | 'US',
        citedText: string,            // the actual quoted clause text
        confidence: number,           // 0-1, model's self-reported confidence
        regexMatched: boolean,        // post-LLM grounding sanity check (D-13)
        regexMatchSpan?: { startChar: number, endChar: number },
      }>,
      evaluatedAgainst: Array<{
        jurisdiction: string,
        phraseLibraryVersion: string,
      }>,
      crossJurisdictionMismatch?: { foundJurisdiction: string, expectedJurisdiction: string },  // D-15
      pendingPhrasesCited?: string[],  // phraseIds whose signoff status is PENDING (D-16)
      rawModelToolUseInput: any,       // for replay/debug; stored verbatim
      runId: string,
      runStartedAt: string,            // ISO-8601
      runCompletedAt: string,
    },
  }
  ```
  Versioned schema (`version: 1`) for future migrations.
- **D-07:** `LIKELY_MISSING` verdict creates an open `ContractorComplianceItem`:
  - **Severity = `WARNING`** (Phase 71 D-05 actual enum). ROADMAP wording "STANDARD" is pre-Phase-71-decision; Phase 75 maps to the actual shipped enum. WARNING = surfaces in Phase 73 admin dashboard, does NOT block payment (matches the offboarding-time-only concern).
  - New per-jurisdiction `policyRuleId` namespaces seeded into `@contractor-ops/compliance-policy/src/policies/`:
    - `uk.ip_assignment@v1`
    - `de.werkvertrag_ip@v1`
    - `pl.ip_assignment@v1`
    - `us.ip_assignment@v1`
    - `ksa.ip_assignment@v1`
    - `uae.ip_assignment@v1`
  - Each rule declares: `documentType: 'IP_RATIFICATION'`, `severity: 'WARNING'`, `expiresAt: null` (these don't expire — present-or-not), `expiryJurisdictionTz: <jurisdiction>` (carried for consistency).
  - Materialisation flow: when verdict is LIKELY_MISSING, classification engine (Phase 71's `materialiseFromPolicy`) inserts a new `ContractorComplianceItem` referencing the relevant policyRuleId with `status = MISSING`.
- **D-08:** IP-ratification e-sign hand-off:
  - Phase 74 D-04 already declares `IP_VERIFICATION` requiredDoc + `WorkflowTaskType.IP_VERIFICATION` enum value (Phase 74 already shipped this). Phase 75 wires the workflow-engine block: any attempt to set `WorkflowRun.completedAt` raises `TRPCError({ code: 'PRECONDITION_FAILED', cause: { blockedTaskKind: 'IP_VERIFICATION', openTaskIds: [...] } })` if the `IP_VERIFICATION` task isn't COMPLETED.
  - Admin clicks the task → system fetches the canonical IP-ratification template (per contractor jurisdiction; templates seeded as part of Phase 75) → routes to:
    - **DocuSign** (UK / PL / US / KSA / UAE) via existing v2.0 `packages/integrations/src/adapters/docusign-adapter.ts` (path resolved during research).
    - **Autenti** (DE) via existing v2.0 `packages/integrations/src/adapters/autenti-adapter.ts` (path resolved during research).
  - On `signing.completed` webhook: in a single transaction, system creates `Document(type=IP_RATIFICATION, status=APPROVED)`, flips `IP_VERIFICATION` task to COMPLETED, and uses Phase 71 D-12 documentType carry-forward to flip the `ContractorComplianceItem` to SATISFIED with `satisfiedByDocumentId = newDocument.id`. Approval-engine recovery hook (Phase 72 D-15) auto-resumes any PENDING_COMPLIANCE approvals held by the now-satisfied item.
  - OWNER-only override path: reuses Phase 74 D-09..D-12 verbatim. Permission `workflow:override_blocking_task` (Phase 74 D-09) is the gate; override modal copy + audit pattern + permanent badge are unchanged. The override targets `IP_VERIFICATION` blockedTaskKind explicitly.
- **D-09:** Drill-into-cited-clause UX — TWO surfaces, ONE shared `<HealthCheckPanel>` component:
  - **Contract detail page:** new "Health check" panel summarising the latest verdict + an expandable list of cited clauses. Each cited clause shows: quoted text (collapsible if long), jurisdiction badge, source badge (`regex+LLM` | `LLM only`), confidence bar, "View in document" button (best-effort PDF coords if captured). PENDING-phrase footer flag per D-16.
  - **AuditLog row:** `compliance.ip_clause.checked` AuditLog entries get a "View clause text" link → modal renders the same `<HealthCheckPanel>` component populated from the historical `ContractHealthCheckRun.resultsJson`.
  - Phase 73 dashboard "At risk" row deep-links here when `policyRuleId` matches `*.ip_assignment@v1` namespace.

### CredentialReference — schema + secret-rejection + rotation flow

- **D-10:** New table `CredentialReference`:
  ```
  id                String   @id @default(cuid())
  offboardingRecordId String
  label             String
  vaultProvider     VaultProvider  // ONE_PASSWORD | BITWARDEN | HASHICORP_VAULT | AWS_SECRETS_MANAGER | GCP_SECRET_MANAGER | AZURE_KEY_VAULT | OTHER
  vaultUrl          String   // pointer URL only — validated server-side per D-11
  accessType        AccessType  // AWS | GITHUB | GCP | AZURE | DATABASE | API_KEY | SSH_KEY | OTHER
  successorUserId   String?  // nullable — sometimes "rotated to nobody, decommissioned"
  status            CredentialStatus  // PENDING | ROTATED | NOT_APPLICABLE
  rotatedAt         DateTime?
  rotatedByUserId   String?
  notes             String?  // free-text, validated per D-11
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([offboardingRecordId])
  @@index([successorUserId])
  @@index([offboardingRecordId, status])  // for the soft-warning gate D-12
  ```
  Phase 76 IdP deprovisioning saga can reference these rows for cross-feature audit.
- **D-11:** Secret-paste rejection — new module `packages/validators/src/secret-shape-detector.ts` exporting `looksLikeSecret(input: string): { matched: boolean, patternId?: string, fieldHint?: string }`. Pattern set:
  - `aws-access-key`: `AKIA[0-9A-Z]{16}` (root or IAM user keys)
  - `aws-secret-access-key`: 40-character base64-shaped string in a vault-URL-or-label position
  - `github-pat-classic`: `ghp_[A-Za-z0-9]{36}`
  - `github-pat-fine-grained`: `github_pat_[A-Za-z0-9_]{82,}`
  - `github-oauth`: `gho_[A-Za-z0-9]{36}`
  - `github-server-token`: `ghs_[A-Za-z0-9]{36}`
  - `jwt`: `^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$`
  - `hex-32-plus`: `^[0-9a-f]{32,}$/i` (catches generic API tokens, MD5/SHA hashes shaped as secrets)
  - `slack-bot-token`: `xox[baprs]-[A-Za-z0-9-]+`
  - `stripe-key`: `sk_(live|test)_[A-Za-z0-9]{24,}`
  - `google-api-key`: `AIza[0-9A-Za-z_-]{35}`
  - `private-key-block`: `-----BEGIN (RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----`
  Zod refinement on EVERY user-input field: `vaultUrl`, `label`, `notes`. tRPC mutation wraps a match in `TRPCError({ code: 'BAD_REQUEST', cause: { reason: 'looks_like_secret', patternId, fieldHint } })`. Client renders inline form-field error: "This looks like a credential value (matched pattern: AWS access key). Please provide a vault URL only — never paste actual secrets." Belt-and-braces: client-side validation gives instant feedback; server-side validation is the truth (PROJECT.md "Never trust client input"). CI test enumerates each pattern with positive + negative cases.
- **D-12:** Rotation-task UX — dedicated "Credentials" tab in the offboarding workflow. Tab content: table with columns [Label | Vault Provider | Access Type | Successor | Status | Actions]. "Add credential" button opens modal with the validated form. Per-row "Mark rotated" + "Edit" + "Remove". Workflow-completion gate is **soft-warning, not hard-block**:
  - When admin attempts `WorkflowRun.completedAt` set, system checks for `CredentialReference WHERE offboardingRecordId = ? AND status = 'PENDING'`. If any exist, returns a soft-warning modal: "3 credentials still pending rotation — complete anyway?" listing them with vault provider + label.
  - Admin can confirm completion (capturing reason in audit log) OR cancel and rotate first. AuditLog entry `workflow.completed_with_pending_credentials` captures the count + admin reason.
  - Hard-block is reserved for `IP_VERIFICATION` (legal exposure). Credentials are an ops-discipline concern; admins legitimately complete with PENDING rows when the contractor pre-rotated and admin missed the row, or vendor offboarding took a third-party flow.

### Per-jurisdiction phrase library + regex matching + Werkvertrag locked-phrase

- **D-13:** Verdict path is **LLM-first with regex grounding/sanity-check**:
  - Always call Claude with the `contract-health-tools.ts` tool_use schema (per ROADMAP wording "reused `ClaudeOcrAdapter`"). Claude returns a tristate verdict + cited clause text + per-clause confidence.
  - Regex library then runs over the cited text to mark each clause's `regexMatched: true | false` (sanity check that what Claude cited is actually IP-assignment language).
  - Two divergence rules raise to MANUAL_REVIEW_REQUIRED:
    - Claude returns LIKELY_PRESENT but NO regex matches the cited text → catches LLM hallucination.
    - Claude returns LIKELY_MISSING but regex finds a strong match in the raw contract text → catches LLM miss.
  - Best of both: regex is the audit-trail discipline; LLM is the natural-language understanding. Replay-ready.
- **D-14:** Phrase library lives in NEW per-jurisdiction modules `packages/validators/src/legal/ip-clauses-{uk,de,pl,us,ksa,uae}.ts`, parallel to Phase 73 D-14's `compliance-{jurisdiction}.ts` modules. Each entry shape:
  ```ts
  // packages/validators/src/legal/ip-clauses-uk.ts
  export const IP_CLAUSES_UK = {
    'uk.hereby_assigns@v1': {
      regex: /\bhereby\s+(absolutely\s+and\s+irrevocably\s+)?assigns?\b/i,
      citedTextExample: '...the Contractor hereby assigns to the Company all intellectual property rights...',
      locale: 'en',
      jurisdiction: 'UK',
      sufficiencyForJurisdiction: 'UK',  // this phrase establishes IP assignment ONLY for UK contracts
      legalBasisRef: 'Copyright, Designs and Patents Act 1988 s.90(1)',
      version: 1,
    },
    // ...
  } as const;
  ```
  Per-file legal review boundaries: UK adviser reviews `ip-clauses-uk.ts`; Steuerberater reviews `ip-clauses-de.ts`; doradca podatkowy reviews `ip-clauses-pl.ts`; etc. The Werkvertrag Schöpferprinzip + Nutzungsrechte distinction (per §7 + §31 UrhG) lives in `ip-clauses-de.ts` with comment block citing the legal basis.
- **D-15:** Werkvertrag jurisdiction-aware verdict + cross-jurisdiction-mismatch flag:
  - The `Contract` model carries `jurisdiction` (set at upload from contractor's country). Health-check ALWAYS evaluates against the contract's declared jurisdiction's phrase library.
  - DE-specific entries in `ip-clauses-de.ts`:
    - `de.urheberrecht_einraeumung_v1` — "Einräumung von Nutzungsrechten gemäß §31 UrhG" (the canonical DE form)
    - `de.ausschliessliches_nutzungsrecht_v1` — "ausschließliches Nutzungsrecht"
    - `de.einfaches_nutzungsrecht_v1` — "einfaches Nutzungsrecht"
    - Marker comment: "§7 UrhG — Schöpferprinzip: creator-rights are inalienable; only Nutzungsrechte (usage rights) can be granted. UK 'hereby assigns' boilerplate is INSUFFICIENT under DE law and must trigger MANUAL_REVIEW_REQUIRED."
  - Verdict engine rule: for DE contracts, matching ONLY UK-namespace phrases (e.g. `uk.hereby_assigns@v1`) WITHOUT any DE-namespace match → verdict = `MANUAL_REVIEW_REQUIRED` with `crossJurisdictionMismatch: { foundJurisdiction: 'UK', expectedJurisdiction: 'DE' }` flag in `resultsJson`.
  - Werkvertrag-specific phrases land PENDING per D-16 — engineers develop with `FLAG_SIGNOFF_BYPASS=local`; production deploy gate is APPROVED-by-Steuerberater.
- **D-16:** Signoff posture — every IP-clause phrase entry lands PENDING in `signoff-registry.json` (Phase 70 D-09 / mirrors Phase 73 D-16):
  - Entries: `legal-signoff.ip_clauses.<phraseId>` per `legal-signoff` namespace.
  - LOCAL-ONLY engineers use `FLAG_SIGNOFF_BYPASS=local` (Phase 70 D-10).
  - Per-jurisdiction legal review (UK adviser; Steuerberater for DE Werkvertrag specifically; doradca podatkowy for PL; local advisers for KSA + UAE; US tax-adviser for US) flips entries to APPROVED in dedicated PRs each carrying `legalTicketRef`.
  - **UI surfacing of unverified status:** when verdict cites a PENDING phrase, the `<HealthCheckPanel>` (D-09) renders a footer flag "¹ Verdict relies on phrasing pending legal review" + the cited phrase carries a subscript marker (Phase 73 D-16 visual convention). `resultsJson.ipAssignment.pendingPhrasesCited[]` field captures this for forensics.
  - The `offboarding-ip-clause-scanner` flag stays PENDING all the way through Phase 75 — engineering ships the engine; the legal-text APPROVALs are the production unblock.
  - Production deploy gate (when LOCAL-ONLY flips): zero PENDING entries in scope of the deploy.

### Claude's Discretion

- Exact `contract-health-tools.ts` Anthropic SDK tool_use schema shape — Researcher to validate against current Anthropic SDK docs via Context7 (ROADMAP "NEEDS RESEARCH" flag specifically called this out).
- Exact PDF coords capture in `regexMatchSpan` — best-effort; depends on whether the existing `ClaudeOcrAdapter` already returns char-level offsets. If not, span fields stay null and "View in document" button opens the PDF in a new tab.
- Exact wording of the IP-ratification e-sign template per jurisdiction — DRAFT only this phase; production wording lands via PRs that flip individual `signoff-registry.json` entries to APPROVED with `legalTicketRef`.
- Whether `Document.rejectionReason` from Phase 73 D-08 is reusable for IP-ratification rejection cases — likely yes; Researcher to confirm.
- Exact admin reconcile-queue surface for retry-able failed health-check runs (`status = 'FAILED'`) — match existing Phase 76 reconcile-queue patterns where applicable.
- Exact font/icon for the PENDING-phrase subscript flag in `<HealthCheckPanel>` — match Phase 73 D-16 convention.
- Exact rate-limiting strategy for the bulk re-run admin script — Researcher pin against Anthropic API rate limits + existing QStash backpressure patterns.
- Whether the soft-warning credential gate (D-12) gets its own AuditLog `action` value or piggybacks on an existing one — recommend dedicated `workflow.completed_with_pending_credentials`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architectural twins & data sources
- `.planning/phases/74-f4-offboarding-workflow-foundation-kt-templates-override-per/74-CONTEXT.md` — Phase 74 decisions: D-04 TaskItem.requiredDocs (`IP_ASSIGNMENT` already declared), D-09..D-12 OWNER-only override pattern (Phase 75 reuses verbatim for IP-block override), D-13 i18n strategy explicitly excludes Werkvertrag (Phase 75 ships it), `WorkflowTaskType.IP_VERIFICATION` enum value already shipped per Phase 74's executed plans.
- `.planning/phases/71-f1-compliance-policy-package-schema-classification-reconcile/71-CONTEXT.md` — Phase 71 decisions: D-02 `policyRuleId` semantic versioning, D-05 actual severity enum `BLOCKING | WARNING | INFO` (NOTE: ROADMAP for Phase 75 says "STANDARD" — that's pre-Phase-71 wording; Phase 75 maps to WARNING per the actual enum), D-12 documentType carry-forward on supersession (used by IP-ratification flow D-08), D-04 PENDING signoff posture for legal-sensitive policy entries, D-15 single-AuditLog-per-invocation pattern.
- `.planning/phases/72-f1-compliance-reminder-cascade-payment-block/72-CONTEXT.md` — Phase 72 D-15 approval recovery hook (auto-resumes PENDING_COMPLIANCE approvals when an item flips SATISFIED) — Phase 75's e-sign-completion path triggers this naturally.
- `.planning/phases/73-f1-compliance-admin-dashboard-portal-self-service-i18n/73-CONTEXT.md` — Phase 73 D-14..D-17 locked-phrase registry pattern Phase 75 mirrors verbatim for IP-clause phrases, D-16 PENDING-flag UI convention.
- `.planning/phases/70-v6-0-foundation-cross-cutting-ci-guards-observability-baseli/70-CONTEXT.md` — Phase 70 D-09 parallel signoff registry (signoff-registry.json), D-10 LOCAL-ONLY `FLAG_SIGNOFF_BYPASS=local` bypass, D-02 typed-constants philosophy.

### Reused infrastructure (Phase 75 does not modify)
- `packages/integrations/src/adapters/claude-ocr-adapter.ts` (or wherever `ClaudeOcrAdapter` lives — Researcher resolves) — v2.0 OCR adapter; Phase 75 reuses verbatim for tool_use invocation. Phase 75 adds new `contract-health-tools.ts` schema file in the SAME package.
- `packages/integrations/src/adapters/docusign-adapter.ts` (Researcher resolves) — v2.0 e-sign for UK/PL/US/KSA/UAE. Phase 75 ROUTES to it; no adapter changes.
- `packages/integrations/src/adapters/autenti-adapter.ts` (Researcher resolves) — v2.0 e-sign for DE. Same routing-only relationship.
- QStash infrastructure (Researcher to enumerate exact import path) — Phase 75 enqueues new `contract-health-check` job kind.
- `@upstash/redis` via `packages/api/src/services/cache.ts` — not used in Phase 75 hot path but available for future operators.

### Schema baseline (extension target)
- `packages/db/prisma/schema/contractor.prisma` — `Contract` model gains `complianceFlagsJson Json?`, `complianceFlagsCheckedAt DateTime?`, `complianceFlagsModelVer String?`, `latestHealthCheckRunId String?` columns (all additive nullable). New `ContractHealthCheckRun` table + new enums `IpAssignmentVerdict`, `RunStatus`, `RunTrigger`.
- `packages/db/prisma/schema/contractor.prisma` (or wherever `OffboardingRecord` lives — Researcher resolves) — new `CredentialReference` table + new enums `VaultProvider`, `AccessType`, `CredentialStatus`.
- `packages/db/scripts/push-all-regions.ts` — multi-region migration tool; Phase 75 schema migration carries Standing Constraint (manual post-deploy run per region).

### Workflow engine integration
- `packages/api/src/services/workflow-engine.ts` (or wherever the workflow engine lives — Phase 74's `overrideBlockingTask` mutation gives a hint at the path; Researcher resolves) — Phase 75 wires the `WorkflowRun.completedAt` hard-block via the existing override-blocking-task framework Phase 74 D-09..D-12 established.
- `packages/api/src/routers/workflow-execution.ts` (Phase 74 added `overrideBlockingTask` here) — Phase 75 reuses the `IP_VERIFICATION` blockedTaskKind value and the existing override mutation.

### Phase 71 policy registry (extension target)
- `packages/compliance-policy/src/registry.ts` — Phase 75 adds 6 new policyRules (`uk.ip_assignment@v1`, `de.werkvertrag_ip@v1`, `pl.ip_assignment@v1`, `us.ip_assignment@v1`, `ksa.ip_assignment@v1`, `uae.ip_assignment@v1`) per D-07.
- `packages/compliance-policy/src/policies/{uk,de,pl,us,ksa,uae}.ts` — per-jurisdiction policy modules; Phase 75 adds the IP-assignment rule to each.

### Locked-phrase registry (Phase 75 extension target)
- `packages/validators/src/legal/{de,gb,en,disclaimers}.ts` — existing per-jurisdiction legal phrase modules.
- `packages/validators/src/legal/compliance-{uk,de,pl,uae,ksa}.ts` — Phase 73 added these for COMPL doc names; Phase 75's IP-clauses live in PARALLEL `ip-clauses-{jurisdiction}.ts` files (D-14).
- `packages/validators/src/legal/signoff-registry.json` + `signoff-registry-schema.ts` — Phase 70 D-09 parallel signoff registry; Phase 75 D-16 adds `legal-signoff.ip_clauses.<phraseId>` entries as PENDING.
- `packages/validators/src/__tests__/locked-phrases-guard.test.ts` — existing parity guard. Phase 75 adds parallel `ip-clauses-parity.test.ts` mirroring Phase 73's `compl-doc-names-parity.test.ts` pattern.

### RBAC / permission registry
- `packages/auth/src/permissions.ts` — Phase 74 D-09 already registered `workflow:override_blocking_task`. Phase 75 reuses it; no new permission entries.

### Audit log
- Existing `audit_log` table — Phase 75 emits: `compliance.ip_clause.checked`, `compliance.ip_clause.manual_rerun`, `workflow.ip_verification.signed`, `workflow.completed_with_pending_credentials`, `credential_reference.created`, `credential_reference.rotated`, `credential_reference.removed`. No new audit-log table.

### Validators package (extension target)
- `packages/validators/src/secret-shape-detector.ts` — NEW module per D-11. Tested via new `packages/validators/src/__tests__/secret-shape-detector.test.ts`.

### tRPC routers (extension target)
- `packages/api/src/routers/contract.ts` (or wherever Contract routes live — Researcher resolves) — Phase 75 adds `contract.rerunHealthCheck(contractIds[])` admin mutation per D-05.
- `packages/api/src/routers/credential-reference.ts` (NEW) — CRUD mutations for `CredentialReference` + the validated `vaultUrl` / `label` / `notes` Zod refinements wired in.
- `packages/api/src/routers/workflow-execution.ts` — Phase 75 EXTENDS the existing `setWorkflowRunCompletedAt` (or equivalent) mutation with the IP_VERIFICATION + soft-credential-warning gates.

### e-sign webhook plumbing
- `apps/web/src/app/api/webhooks/docusign/` (Researcher resolves exact path) — existing v2.0 DocuSign webhook handler. Phase 75 adds `signing.completed` for `IP_RATIFICATION` document type → triggers the atomic transaction in D-08.
- `apps/web/src/app/api/webhooks/autenti/` (Researcher resolves) — same for Autenti / DE.

### Standing constraints
- `.planning/STATE.md` "Standing Project Constraints" — LOCAL-ONLY, legal review DEFERRED. Phase 75's IP-clause phrase additions land PENDING per D-16; `offboarding-ip-clause-scanner` flag stays PENDING all the way through Phase 75.

### ROADMAP entry (success criteria source-of-truth)
- `.planning/ROADMAP.md` "Phase 75: F4 Offboarding — Contract Health Check + IP Verification + Credential Vault" — 5 numbered success criteria. Phase 75 maps:
  - SC #1 → D-01..D-05 (health-check engine: trigger + idempotency + model version + manual re-run)
  - SC #2 → D-06, D-07, D-13, D-14, D-15, D-16 (verdict shape + ContractorComplianceItem creation + per-jurisdiction phrase library + Werkvertrag distinction)
  - SC #3 → D-08 (IP_VERIFICATION hard-block + e-sign hand-off + override path reused from Phase 74)
  - SC #4 → D-10, D-11, D-12 (CredentialReference + secret-paste rejection + rotation flow)
  - SC #5 → D-02, D-09 (per-run history → drill-into-cited-clause UX)

### Requirements
- `.planning/REQUIREMENTS.md` — OFFB-04 (health-check on upload + persisted columns), OFFB-05 (tristate verdict + per-jurisdiction phrase library), OFFB-06 (workflow hard-block + e-sign integration), OFFB-08 (CredentialReference + secret-paste rejection), OFFB-09 (audit log + manual re-run + replay-ready model version).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`ClaudeOcrAdapter`** (v2.0 OCR adapter) — Phase 75 reuses verbatim for tool_use invocation. NEW `contract-health-tools.ts` schema file ships in the same package.
- **DocuSign + Autenti e-sign adapters** (v2.0) — Phase 75 routes per jurisdiction; no adapter modifications.
- **QStash background-job infrastructure** (existing) — Phase 75 enqueues new `contract-health-check` job kind.
- **`@upstash/redis` via `packages/api/src/services/cache.ts`** — available, not in hot path.
- **Phase 71 `@contractor-ops/compliance-policy` package** — Phase 75 D-07 adds 6 new policyRules following the v1 typed-const shape established in Phase 71 D-01.
- **Phase 71 `materialiseFromPolicy` helper** — Phase 75 reuses for LIKELY_MISSING → ContractorComplianceItem creation.
- **Phase 71 D-12 documentType carry-forward** — Phase 75 D-08 e-sign-completion uses this to flip ContractorComplianceItem SATISFIED.
- **Phase 72 D-15 approval recovery hook** — auto-resumes any held approvals when the item flips SATISFIED. Phase 75 doesn't write new code here; the hook fires naturally.
- **Phase 73 `<HealthCheckPanel>`-shape components** (Phase 73 dashboard rendered similar structured-error panels) — Phase 75 D-09 follows the same component shape.
- **Phase 73 D-16 PENDING-phrase UI convention** — Phase 75 D-16 mirrors verbatim.
- **Phase 74 D-09..D-12 OWNER-only override pattern** + `workflow:override_blocking_task` permission — Phase 75 D-08 reuses verbatim for IP-block override; no new permission, no new override modal component.
- **`packages/validators/src/legal/`** modular per-jurisdiction structure — Phase 75 D-14 adds parallel `ip-clauses-{jurisdiction}.ts` modules.
- **Phase 70 D-09 signoff registry + D-10 `FLAG_SIGNOFF_BYPASS=local` bypass** — Phase 75 D-16 follows for IP-clause phrase entries.
- **Existing `Document` model + R2 signed-URL upload pipeline** — Phase 75's IP-ratification flow creates Document rows of type IP_RATIFICATION on e-sign-completion.

### Established Patterns
- **Versioned per-run history table** (Phase 71 D-13 `recreateComplianceAssessment` AuditLog history; v5 `EconomicDependencyAlertState`) — Phase 75 D-02 `ContractHealthCheckRun` follows this.
- **Typed-const model version pinning** (Phase 70 D-02; Phase 71 D-03 `POLICY_RULE_SET_VERSION`) — Phase 75 D-04 `CONTRACT_HEALTH_MODEL_VER` mirrors.
- **Idempotent admin bulk-re-run scripts** (Phase 71 D-13 + 71-07 backfill) — Phase 75's `bulk-rerun-contract-health.ts` mirrors.
- **Per-contractor + bulk admin re-run UX** (Phase 71 D-13) — Phase 75 D-05 follows.
- **Closed-enum + free-text + structured audit pattern** (Phase 71 D-11; Phase 73 D-08; Phase 74 D-09..D-12) — Phase 75 D-12 (credentials soft-warning) + D-08 (IP override) reuse.
- **Per-jurisdiction file boundary in legal registry** (Phase 73 D-14) — Phase 75 D-14 follows for IP-clauses.
- **PENDING signoff entries + LOCAL-ONLY bypass** (Phase 70 D-09; Phase 71 D-04; Phase 73 D-16) — Phase 75 D-16 follows.
- **Replay-ready snapshot pattern** (Phase 71 D-15; Phase 72 D-17 `snapshotJson`) — Phase 75 D-02 + D-06 follow.
- **Workflow-engine hard-block + override gate** (Phase 74 D-04 + D-09..D-12) — Phase 75 D-08 EXTENDS to IP_VERIFICATION blockedTaskKind.
- **LLM-first with regex sanity-check** (NEW pattern Phase 75 establishes; Phase 78 IdP adapters with pre-flight detection share spirit).

### Integration Points
- **`Contract.create` mutation** — Phase 75 adds QStash enqueue per D-01.
- **`packages/api/src/routers/workflow-execution.ts`** — Phase 75 extends `setWorkflowRunCompletedAt` (or equivalent) with IP_VERIFICATION + soft-credential-warning gates.
- **`packages/integrations/.../claude-ocr-adapter.ts`** — Phase 75 invokes via new `contract-health-tools.ts` tool_use schema sibling.
- **`packages/db/prisma/schema/contractor.prisma`** — additive migration: 4 columns on `Contract`, 1 new `ContractHealthCheckRun` table + 3 enums, 1 new `CredentialReference` table + 3 enums. Multi-region apply per Standing Constraint.
- **`packages/compliance-policy/src/policies/{uk,de,pl,us,ksa,uae}.ts`** — Phase 75 D-07 adds 6 new policy rules (one per jurisdiction).
- **`packages/validators/src/legal/`** — 6 new files (D-14) + signoff-registry.json entries (D-16) + new parity test.
- **`packages/validators/src/secret-shape-detector.ts`** — NEW module + tests (D-11).
- **`apps/web/src/app/api/webhooks/{docusign,autenti}/`** — Phase 75 extends webhook handlers for `IP_RATIFICATION` document type.
- **Web UI:** Contract detail page gets Health-check panel; offboarding workflow gets new Credentials tab + IP_VERIFICATION e-sign hand-off button + soft-warning modal on completion. Phase 73 dashboard "At risk" filter already covers severity=WARNING items so IP-clause findings surface naturally.

</code_context>

<specifics>
## Specific Ideas

- Severity mapping `LIKELY_MISSING → WARNING` is deliberate and noted in `<deferred>` — ROADMAP wording "STANDARD" is pre-Phase-71-decision drift. Future ROADMAP rewrite should reconcile.
- LLM-first with regex grounding (D-13) is the audit-trail discipline that justifies the legal-sensitive feature flag posture. The cited-clause regex check is what lets a Steuerberater later say "yes, the verdict was actually grounded in §31 UrhG language" rather than "trust the LLM".
- The Werkvertrag Schöpferprinzip distinction (D-15) is the single most important legal point in Phase 75 — UK boilerplate in a DE contract is INSUFFICIENT. The cross-jurisdiction-mismatch flag is the surface that flags this to admins.
- The CredentialReference table stores POINTERS only — the secret-shape detector (D-11) is the structural defence, not a soft warning. 400 BAD_REQUEST with a clear pattern hint is the design.
- Soft-warning credential gate (D-12) vs hard-block IP_VERIFICATION (D-08) is the deliberate calibration: legal exposure → hard block; ops discipline → confirmable warning. Mirrors Phase 73 D-10 / D-12 calibration philosophy.
- Phase 75 reuses Phase 74's override pattern verbatim — no new permission, no new modal, no new audit shape. This deliberately keeps the OWNER-only override surface area minimal across all v6.0 hard-blocks.
- The PENDING-phrase UI flag (D-16) is the visible "this verdict relies on unverified phrasing" signal — when a future bug-report says "why did this UK contract get flagged?", the answer is right there on the surface.

</specifics>

<deferred>
## Deferred Ideas

- **Synchronous in-mutation health-check call** — rejected in D-01 in favour of QStash background job. Revisit only if QStash latency consistently exceeds 60s SLA.
- **Cron-sweep health-check** — rejected in D-01.
- **Single-row overwrite on Contract** (no per-run history) — rejected in D-02 in favour of versioned `ContractHealthCheckRun` table. Replay-ready audit trail is the v6.0 commitment.
- **Per-org overridable model version** — rejected in D-04 in favour of typed-const + admin-triggered bulk re-run. Org-specific model variance complicates audit reasoning.
- **Auto-bump model on Anthropic deprecation** — rejected in D-04. Silent verdict drift is incompatible with legal-sensitive flag posture.
- **Per-contract button only** (no bulk action) — rejected in D-05 in favour of both surfaces.
- **Verdict-only digest schema** — rejected in D-06 in favour of full structured shape (cited clauses, confidence, raw model output). Replay-ready.
- **Severity = INFO** for LIKELY_MISSING — rejected in D-07 (record-only doesn't give the workflow hook anywhere to bind).
- **Severity = BLOCKING** for LIKELY_MISSING — rejected in D-07 (would block routine payments over an offboarding-time concern).
- **Manual admin marks IP_VERIFICATION complete after off-platform signing** — rejected in D-08. Webhook auto-completion is the only audit-defensible path.
- **DocuSign-only routing (skip Autenti)** — rejected in D-08. Honour established jurisdiction routing.
- **JSON column on OffboardingRecord** for credential references — rejected in D-10 in favour of standalone table. Query-ability + status updates require relational schema.
- **Extend Document model to represent credential references** — rejected in D-10. Documents have file content; credential references explicitly do NOT (the secret never lives in the system).
- **API-layer-only secret regex check** — rejected in D-11 in favour of validators-package + Zod refinement. Client-side instant feedback matters.
- **Allowlist-only vault URL validation** — rejected in D-11. Doesn't catch secrets pasted into label/notes fields.
- **Hard-block on PENDING credentials** at workflow completion — rejected in D-12 in favour of soft-warning. Routine ops legitimately complete with PENDING rows.
- **No credential gate at all** — rejected in D-12.
- **Regex-first verdict path** — rejected in D-13 in favour of LLM-first with regex grounding. Two divergent verdict paths is a maintenance hazard.
- **LLM-only without regex sanity check** — rejected in D-13. Loses replay-from-text-only and hallucination defence.
- **Single flat `legal/ip-clauses.ts` map** — rejected in D-14 in favour of per-jurisdiction modules.
- **Treat all jurisdictions equally for IP assignment** — rejected in D-15. UK boilerplate in DE Werkvertrag is INSUFFICIENT under §7 UrhG; this MUST be encoded.
- **Hard-fail DE contracts that don't have explicit §31 UrhG language** — rejected in D-15 in favour of LLM-first verdict + explicit cross-jurisdiction-mismatch flag. Synonyms exist; LLM understands them; regex enforces grounding.
- **PENDING but no UI flag** — rejected in D-16. The visible signal is the design.
- **Hard-fail any LIKELY_PRESENT verdict that depends on a PENDING phrase** — rejected in D-16. Conflicts with LOCAL-ONLY engineering pattern.
- **PDF char-coordinate capture for cited-clause "View in document"** — partially deferred in D-09; best-effort if `ClaudeOcrAdapter` returns coords, otherwise null + open-PDF-in-new-tab fallback. Full coords-with-highlight is a future enhancement.
- **Severity-name reconciliation `STANDARD ↔ WARNING`** — naming drift between ROADMAP and Phase 71 enum noted; Phase 75 maps to WARNING. Future ROADMAP rewrite should reconcile.
- **Manual override of the QStash dedup window** outside `force: true` flag — not exposed as a UI control; only the admin script for model-bump bulk re-run can bypass at scale.

</deferred>

---

*Phase: 75-f4-offboarding-contract-health-check-ip-verification-credent*
*Context gathered: 2026-04-27*
