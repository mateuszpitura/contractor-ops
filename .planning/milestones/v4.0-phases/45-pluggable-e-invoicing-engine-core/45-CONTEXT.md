# Phase 45: Pluggable E-Invoicing Engine Core - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor the existing KSeF integration into a pluggable e-invoicing architecture with abstract UBL 2.1 core. Country profiles (ZATCA, Peppol, future markets) can plug in by implementing a standard interface without modifying the engine core. Existing KSeF functionality must continue working with zero regression.

</domain>

<decisions>
## Implementation Decisions

### Engine Architecture
- **D-01:** New dedicated `packages/einvoice` package — separate from `packages/integrations`. E-invoicing is a vertical domain (XML generation, validation, parsing, compliance), not an OAuth/webhook integration adapter.
- **D-02:** Country profile registration is Claude's discretion — likely a static registry map (type-safe, tree-shakeable) given the monorepo structure and finite number of country profiles.
- **D-03:** Sync orchestration stays in `packages/api` — the engine (`packages/einvoice`) is a pure domain library handling XML gen/parse/validate. API-layer concerns (Prisma, QStash, notifications, scheduling) remain in the API package. Engine has no infrastructure dependencies.

### KSeF Migration Strategy
- **D-04:** Full extract + refactor — move KSeF code out of `packages/integrations` and `packages/api` into `packages/einvoice/profiles/ksef/`. Refactor the XML parser to use the new UBL 2.1 abstractions. This is a clean break, not a wrapper.
- **D-05:** Belt-and-suspenders regression strategy — migrate existing KSeF tests alongside the code (import path changes only, assertions unchanged) AND add new profile interface conformance tests. Both test suites must pass green.

### UBL 2.1 Abstraction
- **D-06:** Core invoice model only (~15-20 typed fields) — canonical `EInvoice` type covering common fields across all profiles: parties, lines, totals, tax, dates, currency. Profiles map to/from this model and handle country-specific extensions. Full UBL 2.1 typing is overkill for contractor invoicing.
- **D-07:** Engine provides capability hooks (interfaces like `Signable`, `QRCodeable`), profiles implement them. Engine orchestrates the pipeline (generate → sign → QR code), profiles provide the actual crypto and encoding. Engine stays generic and doesn't bundle specific crypto libraries.

### Compliance Status UI
- **D-08:** Dashboard widget + settings detail — summary widget on the main dashboard (green/yellow/red per connected country profile) for at-a-glance monitoring, with drill-down to detailed compliance status in the settings/integrations page.
- **D-09:** Compliance states are Claude's discretion — will design states based on what KSeF, ZATCA, and Peppol actually need (likely: not connected, onboarding/sandbox, active, degraded, suspended).

### Claude's Discretion
- Country profile registration mechanism (D-02) — static registry map preferred
- Compliance state machine design (D-09) — based on actual provider lifecycle needs
- Sync orchestrator refactoring in API layer — how to generalize `ksef-sync-orchestrator` to work with any profile
- Engine internal module structure within `packages/einvoice`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing KSeF implementation (to be refactored)
- `packages/integrations/src/services/ksef-xml-parser.ts` — FA(3) XML parser, PLN minor unit conversion, Zod validation
- `packages/integrations/src/services/ksef-api-client.ts` — KSeF API client (auth, query, download)
- `packages/integrations/src/adapters/ksef-adapter.ts` — KSeF adapter extending BaseAdapter (health status)
- `packages/api/src/services/ksef-sync-orchestrator.ts` — Full sync cycle: decrypt → auth → query → parse → dedupe → match → notify
- `packages/api/src/services/ksef-duplicate-detection.ts` — Cross-source duplicate detection
- `packages/api/src/routers/ksef.ts` — tRPC router: connect, disconnect, sync, status, history
- `packages/validators/src/ksef.ts` — Zod schemas: connection config, parsed invoice, line items

### Integration framework patterns
- `packages/integrations/src/adapters/base-adapter.ts` — BaseAdapter pattern (for reference, not to extend)
- `packages/integrations/src/types/health.ts` — ProviderHealthStatus type

### Test suites to migrate
- `packages/integrations/src/__tests__/ksef-xml-parser.test.ts` — XML parser tests
- `packages/integrations/src/__tests__/ksef-api-client.test.ts` — API client tests
- `packages/api/src/services/__tests__/ksef-sync.test.ts` — Sync orchestrator tests
- `packages/api/src/routers/__tests__/ksef.test.ts` — Router tests

### Requirements
- `.planning/REQUIREMENTS.md` — EINV-01 through EINV-06 (e-invoicing engine requirements)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fast-xml-parser` — already used for KSeF FA(3) parsing, can be reused for UBL 2.1
- `toMinorUnits()` / `dig()` helpers in ksef-xml-parser — generalize for multi-currency
- `BaseAdapter` pattern — reference for how the codebase structures provider abstractions
- `IntegrationConnection` / `IntegrationSyncLog` Prisma models — reusable for compliance tracking
- `decryptCredentials` / `encryptCredentials` — reusable for certificate storage
- QStash integration — reusable for scheduling profile sync jobs

### Established Patterns
- Provider adapter pattern (BaseAdapter → KsefAdapter, SlackAdapter, etc.) — einvoice will follow similar interface-first design
- Zod schema validation at boundaries (ksefConnectionConfigSchema, ksefParsedInvoiceSchema)
- Integer minor units for all monetary values (grosze pattern)
- Fire-and-forget async processing via QStash
- AES-256-GCM per-provider credential encryption

### Integration Points
- `packages/api/src/routers/ksef.ts` — tRPC router needs to delegate to new engine
- `packages/api/src/services/ksef-sync-orchestrator.ts` — needs to use engine's profile interface instead of direct imports
- `packages/api/src/services/invoice-matching.ts` — receives parsed invoices from engine profiles
- Dashboard — new compliance status widget
- Settings/integrations page — compliance detail view

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 45-pluggable-e-invoicing-engine-core*
*Context gathered: 2026-04-11*
