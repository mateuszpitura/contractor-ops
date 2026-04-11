# Phase 45: Pluggable E-Invoicing Engine Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 45-Pluggable E-Invoicing Engine Core
**Areas discussed:** Engine architecture, KSeF migration strategy, UBL 2.1 abstraction depth, Compliance status UI

---

## Engine Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| New packages/einvoice | Dedicated package with its own types, profiles, and XML tooling. Clean separation. | �� |
| Inside packages/integrations | Extend existing integrations package. Mixes concerns. | |
| You decide | Claude picks best fit | |

**User's choice:** New packages/einvoice
**Notes:** E-invoicing is a vertical domain, not just another integration adapter.

| Option | Description | Selected |
|--------|-------------|----------|
| Static registry map | Explicit map, profiles imported and registered at boot. Simple, type-safe. | |
| Plugin discovery | Convention-based discovery, more dynamic. | |
| You decide | Claude picks based on monorepo structure | ✓ |

**User's choice:** You decide
**Notes:** Deferred to Claude's discretion.

| Option | Description | Selected |
|--------|-------------|----------|
| Orchestrator stays in API | Engine handles XML gen/parse/validate. API owns sync, scheduling, notifications. | |
| Move into engine | Engine owns full lifecycle including Prisma/QStash. | |
| You decide | Claude picks the right boundary | ✓ |

**User's choice:** You decide
**Notes:** Deferred to Claude's discretion.

---

## KSeF Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Strangler Fig wrap | New interface wraps existing code. Lowest risk, incremental. | |
| Full extract + refactor | Move KSeF code into einvoice, refactor to use UBL abstractions. Cleaner but bigger diff. | ✓ |
| Adapter shim | Keep KSeF where it is, thin shim in einvoice. Permanent indirection. | |

**User's choice:** Full extract + refactor
**Notes:** User chose the cleaner but higher-risk approach despite STATE.md noting "Strangler Fig pattern" from research. Indicates preference for clean architecture over minimal-diff safety.

| Option | Description | Selected |
|--------|-------------|----------|
| Existing tests must pass as-is | Move tests, no assertion changes, only import path updates. | |
| New tests against profile interface | New conformance test suite, existing tests can be adapted. | |
| Both — belt and suspenders | Migrate existing + add new conformance tests. Maximum safety. | ✓ |

**User's choice:** Both — belt and suspenders
**Notes:** Maximum regression safety to offset the risk of full refactor approach.

---

## UBL 2.1 Abstraction Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Core invoice model only | ~15-20 typed fields covering common fields. Profiles handle extensions. | ✓ |
| Full UBL 2.1 types | Comprehensive TypeScript types for entire UBL spec. | |
| Thin XML passthrough | Raw XML strings, profiles own all parsing. | |

**User's choice:** Core invoice model only
**Notes:** UBL has 200+ elements, most irrelevant to contractor invoicing.

| Option | Description | Selected |
|--------|-------------|----------|
| Engine provides hooks, profiles implement | Capability interfaces (Signable, QRCodeable). Engine orchestrates pipeline. | ✓ |
| Engine provides shared implementations | Engine bundles xml-crypto and QR libs. Profiles configure them. | |
| Fully profile-owned | Engine has no concept of signatures/QR. Each profile handles own. | |

**User's choice:** Engine provides hooks, profiles implement
**Notes:** Keeps engine generic without coupling to specific crypto approaches.

---

## Compliance Status UI

| Option | Description | Selected |
|--------|-------------|----------|
| Settings > Integrations section | Compliance status alongside existing integration connections. | |
| Dedicated compliance page | New top-level route for all compliance info. | |
| Dashboard widget + settings detail | Summary widget on dashboard + drill-down in settings. | ✓ |

**User's choice:** Dashboard widget + settings detail
**Notes:** Best visibility with two surfaces — summary for monitoring, detail for management.

| Option | Description | Selected |
|--------|-------------|----------|
| Simple 3-state | Connected/Warning/Error. Minimal. | |
| Detailed lifecycle states | Not connected, Onboarding, Active, Degraded, Suspended, Deactivated. | |
| You decide | Claude picks based on actual provider needs | ✓ |

**User's choice:** You decide
**Notes:** Deferred to Claude's discretion based on KSeF/ZATCA/Peppol lifecycle needs.

---

## Claude's Discretion

- Country profile registration mechanism (static registry map preferred)
- Compliance state machine design
- Sync orchestrator generalization in API layer
- Engine internal module structure

## Deferred Ideas

None — discussion stayed within phase scope.
