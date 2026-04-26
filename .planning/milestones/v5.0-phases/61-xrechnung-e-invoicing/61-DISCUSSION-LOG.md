# Phase 61: XRechnung E-Invoicing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 61-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 61-xrechnung-e-invoicing
**Areas discussed:** CII generator + KoSIT validation, Leitweg-ID data model + validation, Peppol transmission for UK B2G (EINV-06), Compliance status & lifecycle (EINV-07)

---

## CII Generator + KoSIT Validation (EINV-01 / EINV-04)

### Q1 — CII generator approach

| Option | Description | Selected |
|--------|-------------|----------|
| New profile mirroring peppol-ae's UBL generator | `packages/einvoice/src/profiles/xrechnung-de/` with CII generator sharing `engine/xml-utils.ts` | ✓ |
| Shared CII+UBL dual generator with format flag | Refactor peppol-ae; premature abstraction | |
| External library (mustangproject / @xrechnung/cii-builder) | Third-party CII builder; adds JVM or npm dep | |

**User's choice:** New profile, mirror peppol-ae structure
**Notes:** Matches established pluggable profile pattern.

### Q2 — KoSIT Schematron runner

| Option | Description | Selected |
|--------|-------------|----------|
| Bundle .sch → .xslt files + run locally with saxon-js | Pre-compiled KoSIT artifacts checked into repo; pure JS XSLT evaluation | ✓ |
| Remote to KoSIT's hosted validator HTTP API | External dependency; rate limits; latency | |
| Hybrid: local XSD + remote Schematron | Mixed failure modes | |

**User's choice:** Bundle + saxon-js
**Notes:** Industry-standard approach; deterministic; fully local.

### Q3 — When validation runs

| Option | Description | Selected |
|--------|-------------|----------|
| On-demand + eager at "finalize e-invoice" action | Eager on finalize; manual re-validate CTA anywhere | ✓ |
| Every save — live compliance status | Expensive; complicates save path | |
| On-demand only | Users may ship non-compliant silently | |

**User's choice:** Eager on finalize + on-demand
**Notes:** Canonical XML generated once; re-validation compares hash.

---

## Leitweg-ID Data Model + Validation (EINV-05)

### Q1 — Schema shape

| Option | Description | Selected |
|--------|-------------|----------|
| New LeitwegId entity linked to Contractor AND Contract with per-context override | Supports multiple IDs per contractor + validity periods + history | ✓ |
| Simple string fields — `leitwegId` on Contract + `defaultLeitwegId` on Contractor | Minimal schema; can't handle multi-agency orgs | |
| Single string field on Contract only | Simplest; loses per-contractor convenience | |

**User's choice:** New LeitwegId entity
**Notes:** Real B2G orgs have many IDs; schema must support it cleanly.

### Q2 — Format validation

| Option | Description | Selected |
|--------|-------------|----------|
| Zod schema with regex + check-digit verification | Runs at tRPC boundary; prevents invalid IDs reaching XRechnung | ✓ |
| Regex only (no check digit) | KoSIT catches downstream; worse UX | |
| No validation (free text) | XRechnung fails silently; bad experience | |

**User's choice:** Regex + check-digit verification
**Notes:** Modulo-11-10 per XRechnung spec §BT-10.

### Q3 — Required vs optional

| Option | Description | Selected |
|--------|-------------|----------|
| Required for DE B2G — soft-gate with warning if missing | XML still generates; compliance report flags red | ✓ |
| Hard-required — block XML generation if missing | Safest; annoys non-Leitweg-mandated agencies | |
| Always optional | Allows invalid XRechnung output | |

**User's choice:** Required for DE B2G, soft-gate
**Notes:** `isPublicSectorBuyer` flag on Contractor; hard-block only when Storecove buyer routing requires it.

---

## Peppol Transmission for UK B2G (EINV-06)

### Q1 — Payload shape

| Option | Description | Selected |
|--------|-------------|----------|
| Extend StorecoveAdapter.transmitInvoice with format discriminator | `format: { kind: 'ubl-pint-ae' } | { kind: 'cii-xrechnung', ... } | { kind: 'ubl-peppol-bis-3' }` | ✓ |
| New adapter instance per-format | Duplicates HMAC/webhook/auth wiring | |
| Pre-convert CII to UBL before transmission | Double-generation effort; unnecessary (Peppol UK supports XRechnung-CII directly) | |

**User's choice:** Format discriminator
**Notes:** Additive change; peppol-ae callers unaffected.

### Q2 — Participant registration

| Option | Description | Selected |
|--------|-------------|----------|
| Per-org one-time registration via Storecove + stored peppolParticipantId on Organization | Settings page flow; enum status field | ✓ |
| Auto-register on first UK B2G invoice send | Transparent; harder to debug | |
| Manual registration outside the app | Pushes setup burden to user | |

**User's choice:** Per-org one-time registration
**Notes:** Matches Storecove's billing model; webhook updates status.

### Q3 — Buyer Peppol ID + SML lookup

| Option | Description | Selected |
|--------|-------------|----------|
| User-entered on Contractor + validated via Storecove SML lookup before send | peppolSchemeId + peppolParticipantValue fields; 6h capability cache | ✓ |
| User-entered, no validation before send | Risk of transmission-failed webhooks | |
| Automatic lookup from buyer VAT number | Too brittle for UK (Companies House number more common) | |

**User's choice:** User-entered + SML lookup
**Notes:** PeppolCapabilityCache table with 6h TTL to avoid rate-limit issues.

---

## E-Invoice Lifecycle & Compliance Status (EINV-07)

### Q1 — State model

| Option | Description | Selected |
|--------|-------------|----------|
| New EInvoiceLifecycle model 1:1 with Invoice (append-only transitions via event table) | Clean separation; child EInvoiceLifecycleEvent for audit trail | ✓ |
| Denormalized fields on Invoice | Bloats Invoice; harder to add event history | |
| Event-sourced: single EInvoiceEvent table, no per-invoice lifecycle row | Over-engineered for v5.0 | |

**User's choice:** EInvoiceLifecycle + child event table
**Notes:** Mirrors Phase 60 dual-tier pattern (mutable state row, append-only event log).

### Q2 — Validation report storage

| Option | Description | Selected |
|--------|-------------|----------|
| Structured summary in DB + full KoSIT HTML report in R2 | Normalized summary (first 20 issues) for UI; full report content-addressed in R2 | ✓ |
| Full report JSON inline in DB column | Bloats rows; backup bloat | |
| Summary only — no full report retained | Loses drill-down detail | |

**User's choice:** Summary in DB + full report in R2
**Notes:** Signed URL TTL 300s matching Phase 56/59.

### Q3 — UI surface

| Option | Description | Selected |
|--------|-------------|----------|
| New section on existing invoices list + per-org summary tile + per-invoice "E-invoice" tab | Integrated into current invoice UX | ✓ |
| Separate /e-invoicing/ dashboard page | Fragments invoice UX | |
| Per-invoice tab only, no list-level status surface | Users can't scan compliance at a glance | |

**User's choice:** Integrated into invoices list + per-invoice tab
**Notes:** Summary tile + filter chips + E-invoice tab with generate/validate/send CTAs.

---

## Claude's Discretion

- Exact `XRechnung 3.0.2` pin and matching KoSIT validator-configuration release
- Whether `saxon-js` is pnpm-added or workspace-local optional dep
- SVRL → typed report normalization shape
- `PeppolCapabilityCache` TTL (6h default)
- UI layout of the "E-invoice" invoice-detail tab — defer to frontend-design
- Error-copy localization for LEITWEG_ID_MISSING / PARTICIPANT_NOT_REACHABLE / KOSIT_VALIDATION_FAILED
- Optional admin-only "Force re-validate all invoices" bulk action
- Transmission webhooks → in-app notification wiring (notification-service available via Phase 60, but ship silent update for now)

## Deferred Ideas

Captured in 61-CONTEXT.md `<deferred>` section:
- ZUGFeRD PDF/A-3 with embedded CII (Phase 62)
- Inbound XRechnung/ZUGFeRD parsing (Phase 62)
- UBL-XRechnung variant
- Factur-X / FatturaPA country profiles
- Automatic Peppol Directory listing
- Bulk XRechnung ZIP export
- Embedded line-attachment PDFs
- Digital signature (not required by EN 16931)
- Mustangproject JVM integration
- Private-sector DE XRechnung
- Per-invoice XML manual edit UI
- Historical XRechnung 2.x support
- Automated XRechnung-version upgrade migration
- Leitweg-ID government directory auto-suggest

Reviewed Todos (not folded): none — `gsd-tools todo match-phase 61` returned 0 matches.
