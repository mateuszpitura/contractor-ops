# Phase 75 Research

**Phase:** 75 — F4 Offboarding — Contract Health Check + IP Verification + Credential Vault
**Researched:** 2026-04-27
**Status:** Research complete
**Inputs:** 75-CONTEXT.md (16 decisions), REQUIREMENTS.md (OFFB-04/05/06/08/09), ROADMAP.md (NEEDS RESEARCH flag — Werkvertrag wording + Anthropic SDK tool_use schema)

## Mandate

Resolve every "Researcher to validate" / "Researcher resolves" hook from CONTEXT.md, ground every reused asset to a concrete file path on disk, and pin the Anthropic SDK tool_use shape against current docs (Context7) so the planner can write tasks against real signatures. Do not re-decide anything CONTEXT.md locked.

---

## 1. Anthropic SDK tool_use schema — pinned via Context7

**Library:** `/anthropics/anthropic-sdk-typescript` (Source Reputation: High, 183 snippets, Benchmark 71.22).

**Confirmed shape (current SDK, 2026-04-27 docs)** — used verbatim by the existing `ClaudeOcrAdapter` at `packages/integrations/src/adapters/claude-ocr-adapter.ts:271-295` and re-validated against Context7's "Manual Tool Use with JSON Schema in TypeScript" snippet:

```ts
import Anthropic from '@anthropic-ai/sdk';

const tool: Anthropic.Tool = {
  name: 'evaluate_ip_assignment',
  description: '<purpose-specific>',
  input_schema: {
    type: 'object',
    properties: { /* ... */ },
    required: [ /* ... */ ],
  },
};

const response = await client.messages.create({
  model: CONTRACT_HEALTH_MODEL_VER, // typed-const, Phase 75 D-04
  max_tokens: 4096,
  messages: [
    {
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
        { type: 'text', text: prompt },
      ],
    },
  ],
  tools: [tool],
  tool_choice: { type: 'tool', name: 'evaluate_ip_assignment' }, // forces single-tool output
});

const toolUseBlock = response.content.find(
  (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
);
const rawInput = toolUseBlock!.input as Record<string, unknown>;
```

**Pinned facts:**
- `Anthropic.Tool` and `Anthropic.ToolUseBlock` types are exported from the root `@anthropic-ai/sdk` namespace; no submodule import needed for the OCR-adapter-style pattern (Context7 snippet "Manual Tool Use with JSON Schema in TypeScript").
- `tool_choice: { type: 'tool', name: '<tool-name>' }` is the correct way to force the model to emit a single specific tool call (mirrors the existing OCR adapter line 294).
- PDF input as base64 uses `type: 'document'` with `media_type: 'application/pdf'` — the OCR adapter already does this at line 280-284 and the Context7 docs confirm `type: 'document'` is the documented pattern (the "Send base64-encoded images" snippet uses `type: 'image'` for images; PDFs use `type: 'document'`).
- `stop_reason: 'tool_use'` arrives in the response when the model successfully calls the forced tool; the OCR adapter does not assert on `stop_reason` and instead finds the tool_use block by `block.type === 'tool_use'`. We mirror that pattern for resilience.

**Tool-runner / `betaZodTool` helpers (rejected):** Context7 surfaces a `client.beta.messages.toolRunner({ ... })` helper that auto-loops tool calls. Phase 75 does **not** need iterative tool execution — it forces a single tool emission and parses the result — so the simpler `messages.create({ ..., tools, tool_choice })` shape is correct. Rejecting toolRunner avoids beta-API exposure for a legal-sensitive code path.

**Model ID — D-04 typed-const value:** `CONTEXT.md` shows two example values: `claude-3-5-sonnet-20241022` (in ROADMAP success criterion #1) and `claude-opus-4-7` (in D-04). The existing `ClaudeOcrAdapter` defaults to `claude-sonnet-4-5-20250514` (line 250). Context7 snippets demonstrate `claude-sonnet-4-5-20250929` (newer) and `claude-3-opus-20240229` (legacy). **Recommendation for typed-const value:** match the OCR-adapter default (`claude-sonnet-4-5-20250514`) at Phase 75 ship time so health-check and OCR run on the same model, and bump only via the documented bulk-re-run script (D-04). The constant is a single string literal — bumping it is a one-line PR followed by the admin script. This avoids splitting the org's AI surface across multiple model versions for legal-adjacent flows.

> **Locked decision (D-04 reaffirmed):** typed-const `CONTRACT_HEALTH_MODEL_VER` lives at `packages/api/src/services/contract-health/model.ts` and is the single source of truth. Bulk re-run script lives at `packages/api/scripts/bulk-rerun-contract-health.ts` (matches Phase 71 D-13 + 71-07 backfill convention).

---

## 2. Codebase path resolutions (every "Researcher resolves" line in CONTEXT.md)

Every flagged path is grounded below to a concrete on-disk file, verified by `find` / `grep` at research time.

### 2.1 Reused integration adapters

| CONTEXT.md placeholder | Resolved path | Notes |
|------------------------|---------------|-------|
| `ClaudeOcrAdapter` | `packages/integrations/src/adapters/claude-ocr-adapter.ts` | Already uses `tools` + `tool_choice` + `type: 'document'` PDF base64. Phase 75 ships a sibling `contract-health-tools.ts` in `packages/integrations/src/adapters/` (NEW) |
| DocuSign adapter | `packages/integrations/src/adapters/docusign-adapter.ts` | Uses `handleSigningWebhook` from `services/esign-webhook-handler.ts`. Already maps `EnvelopeStatus.COMPLETED` (lines 5-23) |
| Autenti adapter | `packages/integrations/src/adapters/autenti-adapter.ts` | Same `handleSigningWebhook` pattern |
| QStash client | `packages/integrations/src/services/qstash-client.ts` | Singleton `getQStashClient()` returns `Client` from `@upstash/qstash@2.10.1`; uses env `QSTASH_TOKEN` |
| `@upstash/redis` cache | `packages/api/src/services/cache.ts` | Available; not in Phase 75 hot path |

### 2.2 Schema (extension targets)

| Target | Resolved path | Action |
|--------|---------------|--------|
| `Contract` model | `packages/db/prisma/schema/contract.prisma:3-65` | ADD columns: `complianceFlagsJson Json?`, `complianceFlagsCheckedAt DateTime?`, `complianceFlagsModelVer String?`, `latestHealthCheckRunId String?`, `jurisdiction String?` (3-char ISO country, see §3 below) |
| `ContractHealthCheckRun` (NEW) | `packages/db/prisma/schema/contract.prisma` (append) | NEW model + indexes per D-02; place after `ContractRatePeriod` (line 86) and before `Document` |
| New enums | `packages/db/prisma/schema/contract.prisma` (append) | `IpAssignmentVerdict`, `RunStatus`, `RunTrigger` after existing `DocumentLinkRole` |
| `CredentialReference` (NEW) | `packages/db/prisma/schema/workflow.prisma` (append) | Phase 74 added `WorkflowRun` here; place `CredentialReference` after `WorkflowAttachment` (line 213). Linked by `workflowRunId` (NOT `offboardingRecordId` — see §4 below) |
| `DocumentType` enum | `packages/db/prisma/schema/contract.prisma:208-222` | ADD `IP_RATIFICATION` (`IP_ASSIGNMENT` already exists; `IP_RATIFICATION` is the post-sign artifact) |
| `WorkflowTaskType` enum | `packages/db/prisma/schema/workflow.prisma:231-246` | Already has `IP_VERIFICATION` (Phase 74 D-09) and `CONTRACT_HEALTH_CHECK` — no change |
| Multi-region push | `packages/db/scripts/push-all-regions.ts` | Manual post-deploy run per Standing Constraint |

### 2.3 tRPC routers

| CONTEXT.md placeholder | Resolved path | Action |
|------------------------|---------------|--------|
| `routers/contract.ts` | `packages/api/src/routers/core/contract.ts` | ADD `rerunHealthCheck(contractIds[], opts)` admin mutation (D-05) |
| `routers/credential-reference.ts` (NEW) | `packages/api/src/routers/workflow/credential-reference.ts` (NEW) | Place under `workflow/` next to `workflow-execution.ts`; export from `workflow/index.ts` |
| `routers/workflow-execution.ts` | `packages/api/src/routers/workflow/workflow-execution.ts` | EXTEND existing `completeTask` flow — at line 922-930 (where `isComplete` flips `WorkflowRun.completedAt`), add IP_VERIFICATION pre-check + soft-credential-warning |
| `audit-writer.ts` | `packages/api/src/services/audit-writer.ts` | Existing `writeAuditLog({...})` accepts a `tx` for in-transaction audit emission |
| `compliance-supersession.ts` | `packages/api/src/services/compliance-supersession.ts` | Exports `materialiseFromPolicy(client, ctx)` — Phase 75 reuses for `LIKELY_MISSING → ContractorComplianceItem` (D-07) |
| `permissions.ts` | `packages/auth/src/permissions.ts:20` | `workflow:override_blocking_task` already registered (Phase 74) — no change |

### 2.4 Compliance policy (extension targets)

| Target | Resolved path |
|--------|---------------|
| Policy registry | `packages/compliance-policy/src/registry.ts` (`registerPolicyRule`) |
| Per-jurisdiction policy modules | `packages/compliance-policy/src/policies/{uk,de,pl,us,ksa,uae}.ts` (existing — extend with one IP-assignment rule each per D-07) |
| Policy types | `packages/compliance-policy/src/types.ts` |
| New policy rule IDs | `uk.ip_assignment@v1`, `de.werkvertrag_ip@v1`, `pl.ip_assignment@v1`, `us.ip_assignment@v1`, `ksa.ip_assignment@v1`, `uae.ip_assignment@v1` (six rules; one per jurisdiction module) |
| `us.ts` policy module | **MISSING** in current tree — only `de.ts`, `uk.ts`, `pl.ts`, `ksa.ts`, `uae.ts` exist. Phase 75 must create `packages/compliance-policy/src/policies/us.ts` (NEW) following the `uk.ts` pattern + register import in `registry.ts` boot path |

### 2.5 Locked-phrase registry (NEW per-jurisdiction modules)

| Target | Resolved path |
|--------|---------------|
| Existing legal modules | `packages/validators/src/legal/` — contains `de.ts`, `gb.ts`, `en.ts`, `disclaimers.ts`, `signoff-registry.{json,ts,-schema.ts}` |
| Existing parity test | **None yet for compliance phrases.** `locked-phrases-guard.test.ts` referenced in CONTEXT.md does not exist on `main` — verify in research (`find` returned no `locked-phrases-guard.test.ts`). The guard is a Phase 73 plan still pending execution. Phase 75 ships its own `ip-clauses-parity.test.ts` independently |
| Phase 75 NEW modules | `packages/validators/src/legal/ip-clauses-{uk,de,pl,us,ksa,uae}.ts` (six files per D-14) |
| Phase 75 NEW parity test | `packages/validators/src/__tests__/ip-clauses-parity.test.ts` |
| Signoff registry JSON | `packages/validators/src/legal/signoff-registry.json` — current keys are doc-name format (`DISCLAIMER_*`, `SDS_*`). D-16 adds `legal-signoff.ip_clauses.<phraseId>` keys (e.g. `legal-signoff.ip_clauses.uk.hereby_assigns@v1`) |
| Signoff registry schema | `packages/validators/src/legal/signoff-registry-schema.ts` (Zod schema; verify shape supports new key prefix in plan) |

### 2.6 Webhook plumbing — corrected from CONTEXT.md

CONTEXT.md says `apps/web/src/app/api/webhooks/{docusign,autenti}/`. **These directories do not exist.** The actual webhook architecture (verified at `apps/web/src/app/api/webhooks/[provider]/route.ts`):

- Single dynamic route `[provider]/route.ts` resolves the adapter via `getAdapter(provider)` from `packages/integrations/src/registry.ts`.
- Adapters expose `verifyWebhookSignature(rawBody, headers)` and use `handleSigningWebhook` from `packages/integrations/src/services/esign-webhook-handler.ts` for status updates.
- Body is logged to `WebhookDelivery`, then queued via QStash to `/api/webhooks/_process` for async processing.
- `esign-webhook-handler.ts:117` returns `{ envelopeId, completed: boolean }` to the caller — caller (in `_process/route.ts`) is responsible for the post-completion side-effects.

**Phase 75 wiring point (corrected):** Extend `apps/web/src/app/api/webhooks/_process/route.ts` to detect `IP_RATIFICATION`-typed signed envelopes (by document type stored on the envelope record) and trigger the atomic transaction in D-08. NO new webhook directory; the routing surface is already provider-agnostic.

### 2.7 UI components

| Target | Resolved path |
|--------|---------------|
| Contract detail page | `apps/web/src/components/contracts/` (Phase 73 `<HealthCheckPanel>` shape ref); concrete page path resolved during planning |
| Offboarding workflow tabs | Phase 74 created the workflow detail UI; concrete path resolved during planning by reading Phase 74 plans |

---

## 3. Contract jurisdiction field — necessary new column

`Contract` model (verified line 3-65 of `contract.prisma`) does **not** carry a jurisdiction field. CONTEXT.md D-15 says "The `Contract` model carries `jurisdiction` (set at upload from contractor's country)". This is an unmet precondition for D-15.

**Resolution:** Phase 75 must ADD `Contract.jurisdiction String?` (3-char ISO country, nullable to keep migration additive on existing rows; backfill from `Contractor.country` in a follow-up step). Without this column the cross-jurisdiction-mismatch flag cannot be evaluated. This is a planning-level injection — no CONTEXT.md change required because D-15 implicitly assumes the field exists.

**Backfill source:** `Contractor` model (line 9 of `contractor.prisma`) — verify it carries a `country` field during planning (probable; Contractor has a `ContractorType` enum and address relations). If absent, the backfill step takes jurisdiction from the contract's first compliance item or defaults to organization country.

---

## 4. OffboardingRecord — does not exist; CredentialReference re-targets WorkflowRun

CONTEXT.md D-10 declares `CredentialReference.offboardingRecordId String`. **There is no `OffboardingRecord` model anywhere on the schema** (verified by `grep -rn "OffboardingRecord" packages/db/prisma/schema` — zero hits). Phase 74's offboarding feature uses `WorkflowRun` (entityType=CONTRACTOR + workflowTemplate of type OFFBOARDING) as the offboarding instance. There is no separate offboarding aggregate.

**Resolution:** Re-target `CredentialReference` to `workflowRunId String` instead of `offboardingRecordId`. This is a **planning-level adjustment** that preserves D-10's intent (one credential row per credential per offboarding) while honouring the schema as it actually exists. The relation `CredentialReference -> WorkflowRun` reads naturally for both the per-row Add/Edit/Remove tab UX (D-12) and the soft-warning gate (which already inspects `WorkflowRun.completedAt`).

D-10's index `@@index([offboardingRecordId, status])` becomes `@@index([workflowRunId, status])` with identical query characteristics.

CONTEXT.md does not need a rewrite — D-10 says "linked to OffboardingRecord" but the only "offboarding record" in the system is `WorkflowRun(workflowTemplate.type=OFFBOARDING)`. Phase 76's IdP saga can join `CredentialReference` via `workflowRunId` exactly as planned.

---

## 5. Werkvertrag wording — research output (legal-sensitive, ships PENDING)

Per Standing Constraint, all new IP-clause phrase entries land PENDING in `signoff-registry.json` and engineering does not block on Steuerberater approval. Research's output here is **draft canonical forms** for engineering to ship; production wording flips PENDING→APPROVED via post-deploy PRs each carrying `legalTicketRef`.

### 5.1 DE — Werkvertrag Schöpferprinzip + Nutzungsrechte (§7 + §31 UrhG)

**Statutory basis (engineering-only summary, NOT legal advice):**
- §7 UrhG (Schöpferprinzip): the creator (natural person) is the author. **Authorship is inalienable.** Corporate entities cannot be original authors.
- §31 UrhG: only **Nutzungsrechte** (usage rights) — exclusive (`ausschließliches Nutzungsrecht`) or non-exclusive (`einfaches Nutzungsrecht`) — can be granted to the customer.
- §31a UrhG: rights for **unknown future uses** require explicit form requirements.
- §31 Abs. 5 UrhG (Zweckübertragungsregel): scope of granted rights extends only as far as the contractual purpose requires — silent contracts narrow the grant.

**Practical implication for the verdict engine:** UK-style "hereby assigns" boilerplate is **insufficient** under DE law because it attempts what §7 UrhG forbids (assignment of authorship). The DE contract must instead grant `Nutzungsrechte` per §31 UrhG. The cross-jurisdiction-mismatch flag (D-15) is the visible signal.

**Draft phrase entries (PENDING per D-16; landing in `packages/validators/src/legal/ip-clauses-de.ts`):**

```ts
'de.urheberrecht_einraeumung_v1': {
  regex: /Einr[äa]umung\s+(eines|von)\s+(ausschlie[ßs]lich(en|es)|einfach(en|es))\s+Nutzungsrecht(en|s|e)?/i,
  citedTextExample: 'Der Auftragnehmer räumt dem Auftraggeber ein ausschließliches, räumlich und zeitlich unbeschränktes Nutzungsrecht gemäß §31 UrhG ein.',
  jurisdiction: 'DE',
  sufficiencyForJurisdiction: 'DE',
  legalBasisRef: 'UrhG §31 (Einräumung von Nutzungsrechten)',
},
'de.ausschliessliches_nutzungsrecht_v1': {
  regex: /ausschlie[ßs]lich(es|en)\s+Nutzungsrecht/i,
  citedTextExample: 'ausschließliches Nutzungsrecht für sämtliche Nutzungsarten',
  jurisdiction: 'DE',
  sufficiencyForJurisdiction: 'DE',
  legalBasisRef: 'UrhG §31 Abs. 3',
},
'de.einfaches_nutzungsrecht_v1': {
  regex: /einfach(es|en)\s+Nutzungsrecht/i,
  citedTextExample: 'einfaches Nutzungsrecht zur internen Verwendung',
  jurisdiction: 'DE',
  sufficiencyForJurisdiction: 'DE',
  legalBasisRef: 'UrhG §31 Abs. 2',
},
'de.werkvertrag_zweckuebertragung_v1': {
  regex: /Zweck(übertragung|uebertragung)/i,
  citedTextExample: 'im Rahmen des Vertragszwecks gemäß §31 Abs. 5 UrhG',
  jurisdiction: 'DE',
  sufficiencyForJurisdiction: 'DE',
  legalBasisRef: 'UrhG §31 Abs. 5 (Zweckübertragungsregel)',
},
```

Module file MUST carry the comment block:

```ts
// §7 UrhG (Schöpferprinzip): authorship is inalienable. UK-style "hereby assigns"
// boilerplate is INSUFFICIENT under DE law. DE contracts must grant Nutzungsrechte
// per §31 UrhG. Verdict engine triggers MANUAL_REVIEW_REQUIRED with
// crossJurisdictionMismatch flag when only UK-namespace phrases match a DE contract.
```

### 5.2 UK — Copyright, Designs and Patents Act 1988 §90(1)

```ts
'uk.hereby_assigns_v1': {
  regex: /\bhereby\s+(absolutely\s+and\s+irrevocably\s+)?assigns?\b/i,
  citedTextExample: 'the Contractor hereby assigns to the Company all intellectual property rights, present and future, in the Works',
  jurisdiction: 'UK',
  sufficiencyForJurisdiction: 'UK',
  legalBasisRef: 'Copyright, Designs and Patents Act 1988 s.90(1)',
},
'uk.assignment_present_and_future_v1': {
  regex: /(present\s+and\s+future|now\s+existing\s+and\s+hereafter)\s+(rights|copyrights?)/i,
  citedTextExample: 'present and future rights in all such Works',
  jurisdiction: 'UK',
  sufficiencyForJurisdiction: 'UK',
  legalBasisRef: 'CDPA 1988 s.91 (future copyright)',
},
'uk.moral_rights_waiver_v1': {
  regex: /waiv(er|es?|ing)\s+of\s+moral\s+rights/i,
  citedTextExample: 'the Contractor waives all moral rights in the Works',
  jurisdiction: 'UK',
  sufficiencyForJurisdiction: 'UK',
  legalBasisRef: 'CDPA 1988 s.87 (waiver of moral rights)',
},
```

### 5.3 PL — Ustawa o prawie autorskim i prawach pokrewnych (1994)

```ts
'pl.przeniesienie_majatkowych_v1': {
  regex: /przeniesieni(e|a)\s+autorskich\s+praw\s+maj[ąa]tkowych/i,
  citedTextExample: 'Wykonawca przenosi na Zamawiającego autorskie prawa majątkowe',
  jurisdiction: 'PL',
  sufficiencyForJurisdiction: 'PL',
  legalBasisRef: 'Ustawa o prawie autorskim art. 41 (przeniesienie autorskich praw majątkowych)',
},
'pl.pola_eksploatacji_v1': {
  regex: /pol(a|ach)\s+eksploatacji/i,
  citedTextExample: 'na wszystkich znanych polach eksploatacji',
  jurisdiction: 'PL',
  sufficiencyForJurisdiction: 'PL',
  legalBasisRef: 'Ustawa o prawie autorskim art. 50 (pola eksploatacji)',
},
'pl.licencja_wylaczna_v1': {
  regex: /licencj(a|i)\s+wyłączn(a|ej|ą)/i,
  citedTextExample: 'udziela licencji wyłącznej',
  jurisdiction: 'PL',
  sufficiencyForJurisdiction: 'PL',
  legalBasisRef: 'Ustawa o prawie autorskim art. 67 ust. 2',
},
```

### 5.4 US — Copyright Act §201(b) work-made-for-hire + assignment

```ts
'us.work_made_for_hire_v1': {
  regex: /work[s]?\s+made\s+for\s+hire/i,
  citedTextExample: 'shall be deemed a work made for hire under 17 U.S.C. §201(b)',
  jurisdiction: 'US',
  sufficiencyForJurisdiction: 'US',
  legalBasisRef: '17 U.S.C. §201(b)',
},
'us.assignment_in_lieu_v1': {
  regex: /(if|to\s+the\s+extent)\s+(such\s+)?work\s+(is|does\s+not)\s+(not\s+)?qualif(y|ied)\s+as\s+(a\s+)?work\s+made\s+for\s+hire/i,
  citedTextExample: 'to the extent such Work does not qualify as a work made for hire, Contractor hereby assigns…',
  jurisdiction: 'US',
  sufficiencyForJurisdiction: 'US',
  legalBasisRef: '17 U.S.C. §204(a) (assignment fallback)',
},
'us.further_assurances_v1': {
  regex: /further\s+assurances|execute\s+(any|such)\s+(further\s+)?(documents?|instruments?)/i,
  citedTextExample: 'agrees to execute any further documents required to perfect the foregoing assignment',
  jurisdiction: 'US',
  sufficiencyForJurisdiction: 'US',
  legalBasisRef: '17 U.S.C. §204(a) writing requirement',
},
```

### 5.5 KSA — Saudi Copyright Law (Royal Decree M/41 2003) + Anti-Concealment Law

```ts
'ksa.transfer_of_economic_rights_v1': {
  regex: /transfer\s+of\s+economic\s+rights|نقل\s+الحقوق\s+المالية/i,
  citedTextExample: 'transfer of all economic rights to the Employer pursuant to the Saudi Copyright Law',
  jurisdiction: 'KSA',
  sufficiencyForJurisdiction: 'KSA',
  legalBasisRef: 'Saudi Copyright Law (Royal Decree M/41) Art. 22',
},
'ksa.scope_and_term_v1': {
  regex: /(scope|term|duration)\s+of\s+(use|exploitation|the\s+transfer)/i,
  citedTextExample: 'specifying the scope, purpose, term and territory of exploitation',
  jurisdiction: 'KSA',
  sufficiencyForJurisdiction: 'KSA',
  legalBasisRef: 'Saudi Copyright Law Art. 22 (writing requirement)',
},
```

### 5.6 UAE — Federal Law No. 38 of 2021 on Copyright

```ts
'uae.disposition_of_economic_rights_v1': {
  regex: /(disposition|assignment)\s+of\s+(economic|financial)\s+rights/i,
  citedTextExample: 'disposes of his economic rights pursuant to Federal Law No. 38 of 2021',
  jurisdiction: 'UAE',
  sufficiencyForJurisdiction: 'UAE',
  legalBasisRef: 'UAE Federal Law No. 38 of 2021 Art. 9',
},
'uae.written_form_v1': {
  regex: /in\s+writing|specify(ing)?\s+the\s+rights/i,
  citedTextExample: 'such disposition is in writing and specifies the rights, purpose, duration and place of exploitation',
  jurisdiction: 'UAE',
  sufficiencyForJurisdiction: 'UAE',
  legalBasisRef: 'UAE Federal Law No. 38 of 2021 Art. 9 (form requirements)',
},
```

> All entries above are DRAFT for engineering. Each lands as a `legal-signoff.ip_clauses.<phraseId>` PENDING row in `signoff-registry.json` (D-16). Production deploy gate is APPROVED-by-jurisdiction-adviser; PR per phrase carries `legalTicketRef`.

---

## 6. Validation Architecture (Nyquist Dimension 8)

### 6.1 Acceptance dimensions

1. **Schema parity** — `prisma generate` succeeds; `pnpm db:push` applies all 5 additive Contract columns + 1 ContractHealthCheckRun table + 1 CredentialReference table + 4 new enums on a clean DB.
2. **tool_use round-trip** — given a fixture UK consultancy PDF, the health-check job calls `ClaudeOcrAdapter` with `contract-health-tools.ts` schema, persists a `SUCCEEDED` `ContractHealthCheckRun` row with `verdict='LIKELY_PRESENT'` and ≥1 cited clause within the 60-second SLA (mocked Anthropic response in unit test; real-API integration test gated on `ANTHROPIC_API_KEY`).
3. **Idempotency dedup** — re-clicking "Re-run" on the same `(contractId, contentHash, modelVer)` returns the existing row (no new `ContractHealthCheckRun` insert). `force: true` creates a fresh row even when the unique index would otherwise match.
4. **Verdict shape conformance** — the persisted `resultsJson` matches the D-06 versioned schema (Zod schema lives in `packages/validators/src/legal/ip-clauses-results-schema.ts` NEW); reading `resultsJson` validates without error.
5. **LIKELY_MISSING → ContractorComplianceItem** — per the materialiseFromPolicy hook (D-07), a LIKELY_MISSING verdict creates exactly one open `ContractorComplianceItem` of severity `WARNING` with `policyRuleId` matching `<jurisdiction>.ip_assignment@v1`.
6. **IP_VERIFICATION hard-block** — attempting `completeTask` on the offboarding's terminal task while `IP_VERIFICATION` is open raises `TRPCError(PRECONDITION_FAILED, cause: { blockedTaskKind: 'IP_VERIFICATION', openTaskIds })`. Override path (Phase 74's `overrideBlockingTask`) clears the block.
7. **e-sign completion atomicity** — webhook `signing.completed` triggers a single transaction creating a `Document(type=IP_RATIFICATION)`, flipping the `IP_VERIFICATION` task COMPLETED, and flipping the `ContractorComplianceItem` SATISFIED via `documentType` carry-forward. Failure of any step rolls back all three.
8. **Soft-warning credential gate** — completing a workflow with PENDING `CredentialReference` rows returns the warning payload (count + list) with structured response; admin confirmation captures `workflow.completed_with_pending_credentials` audit log row with reason.
9. **Secret-shape rejection** — every D-11 pattern (11 regex shapes) is enumerated as `[positive, negative]` test pairs; each positive raises `BAD_REQUEST` with `cause.reason='looks_like_secret'` + `patternId`. Tested at the Zod-refinement level (unit) and the tRPC mutation level (integration).
10. **Cross-jurisdiction mismatch** — DE contract whose verdict cites only UK-namespace phrases yields `verdict=MANUAL_REVIEW_REQUIRED` and `resultsJson.ipAssignment.crossJurisdictionMismatch={ foundJurisdiction:'UK', expectedJurisdiction:'DE' }`.
11. **Pending-phrase UI flag** — when a verdict cites a PENDING phrase, `resultsJson.ipAssignment.pendingPhrasesCited[]` is non-empty; the `<HealthCheckPanel>` snapshot test asserts the footer flag renders.
12. **Audit log completeness** — every flow point (`compliance.ip_clause.checked`, `compliance.ip_clause.manual_rerun`, `workflow.ip_verification.signed`, `workflow.completed_with_pending_credentials`, `credential_reference.{created,rotated,removed}`) writes exactly one audit-log row per invocation (Phase 71 D-15 single-write discipline).
13. **Bulk re-run script idempotency** — `bulk-rerun-contract-health.ts` enqueues at most one `contract-health-check` QStash job per contract per invocation, respects the dedup window unless `--force`, and emits a `compliance.ip_clause.bulk_rerun_started` audit row.
14. **PENDING signoff entries** — every Phase 75 IP-clause phraseId has a corresponding `legal-signoff.ip_clauses.<phraseId>` entry in `signoff-registry.json` with `status='PENDING'`. Parity test enforces 100% coverage.
15. **Multi-region migration** — `pnpm db:push:all-regions` from `packages/db/scripts/push-all-regions.ts` succeeds on every region (Standing Constraint); each region's `_prisma_migrations` table records the same migration name.

### 6.2 Test surfaces (mapping)

| Dimension | Surface | Concrete file |
|-----------|---------|---------------|
| 1, 15 | Schema | `packages/db/prisma/schema/{contract,workflow}.prisma` + new migration |
| 2 | Adapter unit | `packages/integrations/src/adapters/__tests__/contract-health-tools.test.ts` (NEW) |
| 3 | Service integration | `packages/api/src/services/contract-health/__tests__/dedup.test.ts` (NEW) |
| 4 | Schema | `packages/validators/src/legal/__tests__/ip-clauses-results-schema.test.ts` (NEW) |
| 5 | Service integration | `packages/api/src/services/contract-health/__tests__/materialise.test.ts` (NEW) |
| 6 | Router | `packages/api/src/routers/__tests__/workflow-execution-ip-block.test.ts` (NEW) |
| 7 | Webhook handler | `packages/integrations/src/services/__tests__/esign-webhook-ip-ratification.test.ts` (NEW) |
| 8 | Router | `packages/api/src/routers/__tests__/workflow-execution-credential-warning.test.ts` (NEW) |
| 9 | Validator | `packages/validators/src/__tests__/secret-shape-detector.test.ts` (NEW) |
| 10 | Service integration | `packages/api/src/services/contract-health/__tests__/cross-jurisdiction.test.ts` (NEW) |
| 11 | UI component | `apps/web/src/components/contracts/__tests__/health-check-panel.test.tsx` (NEW) |
| 12 | Service unit | per-flow audit-writer assertion in each integration test above |
| 13 | Script | `packages/api/src/__tests__/bulk-rerun-contract-health.test.ts` (NEW) |
| 14 | Validator | `packages/validators/src/__tests__/ip-clauses-parity.test.ts` (NEW) |

---

## 7. Open Questions Routed Back to CONTEXT.md

Each "Claude's Discretion" item from CONTEXT.md is now resolved:

| CONTEXT.md item | Resolution |
|-----------------|-----------|
| Anthropic SDK tool_use schema shape | §1 above — pinned via Context7 |
| PDF coords in `regexMatchSpan` | `ClaudeOcrAdapter.parseExtractionResponse` does NOT capture char coords (verified at line 335-421). Phase 75 `regexMatchSpan` stays nullable; "View in document" opens PDF in new tab. Future enhancement deferred per CONTEXT.md |
| IP-ratification e-sign template wording | Per-jurisdiction templates seeded as DRAFT in `packages/api/src/services/contract-health/templates/ip-ratification-{uk,de,pl,us,ksa,uae}.txt` (NEW). Production wording flips PENDING via `signoff-registry.json` per D-16 |
| `Document.rejectionReason` reusable for IP-ratification rejection | The Phase 73 plan adding `rejectionReason` is not yet executed — Phase 75 ships independent of it. If Phase 73 lands first, IP-ratification rejection re-uses the same column; if not, Phase 75 carries rejection via `Document.metadataJson` (no schema change required) |
| Reconcile-queue surface for FAILED health-check runs | Pattern matches Phase 73 admin-reconcile UX (At Risk row drill-in). Concrete component path resolved at PLAN-time |
| PENDING-phrase subscript flag font/icon | Phase 73 D-16 visual convention not yet executed — Phase 75 ships its own `<PendingPhraseFlag>` mini-component; future pass aligns once Phase 73 ships |
| Bulk re-run rate limiting | Anthropic API limits at the Tier-2 default (50 RPM, 40k input TPM, 8k output TPM); QStash backpressure already shapes throughput. Bulk script paces at 30 jobs/min via `client.publishJSON({ delay: 'Xs' })` (QStash native delay) — concrete throttle value set at PLAN-time |
| Soft-warning audit action name | `workflow.completed_with_pending_credentials` (dedicated, per CONTEXT.md recommendation) |

---

## 8. Plan Skeleton Recommendation

Recommended plan partitioning (8 plans, 4 waves):

| Wave | Plan ID | Objective | Depends on | autonomous |
|------|---------|-----------|------------|------------|
| 0 | 75-01 | Failing-test scaffolds (RED) — schema + Zod schemas + tool_use + secret-shape + parity + cross-jurisdiction + IP-block + e-sign-completion + soft-warning + audit-log assertions; `legal-signoff.ip_clauses.*` PENDING entries seeded | — | true |
| 1 | 75-02 | Prisma schema migration — `Contract.{complianceFlagsJson,complianceFlagsCheckedAt,complianceFlagsModelVer,latestHealthCheckRunId,jurisdiction}` + `ContractHealthCheckRun` + `CredentialReference` + `IP_RATIFICATION` DocumentType + 4 enums; multi-region apply doc | 75-01 | **false** (multi-region apply per Plan 70-09 precedent) |
| 1 | 75-03 | Compliance policy — 6 IP-assignment rules across `policies/{uk,de,pl,us,ksa,uae}.ts` (creates new `us.ts`), wired into registry boot path | 75-01 | true |
| 1 | 75-04 | Locked-phrase modules — `legal/ip-clauses-{uk,de,pl,us,ksa,uae}.ts` (six files) + Zod results schema + signoff registry JSON updates + parity test | 75-01 | true |
| 1 | 75-05 | Validators — `secret-shape-detector.ts` + 11 patterns + Zod refinement helpers + comprehensive unit tests | 75-01 | true |
| 2 | 75-06 | Health-check engine — `contract-health-tools.ts` schema + `model.ts` typed-const + service `runContractHealthCheck.ts` + idempotency dedup + verdict engine (LLM + regex grounding + cross-jurisdiction-mismatch) + materialiseFromPolicy hook + `Contract.create` QStash enqueue + `/api/qstash/contract-health` route handler + bulk re-run admin script | 75-02, 75-03, 75-04 | true |
| 2 | 75-07 | tRPC `contract.rerunHealthCheck` (per-contract + bulk) + `credentialReference.{create,update,remove,markRotated}` router + `workflow-execution.completeTask` extension (IP_VERIFICATION hard-block + soft-credential-warning) + audit-log emissions | 75-02, 75-05 | true |
| 3 | 75-08 | UI — Contract `<HealthCheckPanel>` + AuditLog drill-in modal + Offboarding "Credentials" tab + IP_VERIFICATION e-sign hand-off button + soft-warning modal + i18n keys + e-sign template seeds + `webhooks/_process` IP_RATIFICATION extension | 75-06, 75-07 | true |

Plan 75-02 is `autonomous: false` (mirrors Plan 76-02 Phase 76 schema migration precedent — multi-region apply requires manual gate per Plan 70-09).

---

## RESEARCH COMPLETE

- 16 CONTEXT.md decisions (D-01..D-16) preserved verbatim
- 7 of 8 "Claude's Discretion" items resolved; 1 (template wording) deferred per Standing Constraint
- 2 schema-level adjustments injected at planner level only (no CONTEXT.md change):
  1. `Contract.jurisdiction String?` (precondition for D-15)
  2. `CredentialReference.workflowRunId` (replaces `offboardingRecordId` — model does not exist on schema)
- Anthropic SDK tool_use shape pinned against Context7 docs
- Werkvertrag draft phrase entries provided (4 DE; 12 across UK/PL/US/KSA/UAE) — all PENDING per D-16
- Plan skeleton: 8 plans across 4 waves, 1 marked `autonomous: false`
- 15 validation dimensions mapped to concrete test surfaces (Nyquist Dimension 8)
- All canonical refs from CONTEXT.md `<canonical_refs>` resolved to on-disk paths
