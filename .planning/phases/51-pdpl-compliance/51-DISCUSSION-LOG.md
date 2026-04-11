# Phase 51: PDPL Compliance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 51-PDPL Compliance
**Areas discussed:** Privacy notices & consent, Legal document generation, Onboarding integration

---

## Privacy Notices & Consent

| Option | Description | Selected |
|--------|-------------|----------|
| Granular per-purpose toggles | Individual toggle per processing purpose. Purpose-specific consent. | ✓ |
| Accept all / reject optional | Required auto-accepted, optional bundled. | |
| You decide | Claude picks | |

**User's choice:** Granular per-purpose toggles

| Option | Description | Selected |
|--------|-------------|----------|
| ConsentRecord Prisma table | Dedicated table. Immutable append-only. Auditable. | ✓ |
| Audit log extension | Reuse existing audit log. Harder to query. | |
| You decide | Claude picks | |

**User's choice:** ConsentRecord Prisma table

---

## Legal Document Generation

| Option | Description | Selected |
|--------|-------------|----------|
| Template-based PDF with org data | Templates per jurisdiction, org data merged, React-PDF. | ✓ |
| Static PDF uploads | Pre-generated PDFs. Less dynamic. | |
| You decide | Claude picks | |

**User's choice:** Template-based PDF with org data

---

## Onboarding Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Blocking consent step | Privacy step in wizard after country selection. Required purposes block. | ✓ |
| Non-blocking banner | Banner after onboarding. Risk of non-compliance. | |
| You decide | Claude picks | |

**User's choice:** Blocking consent step

---

## Claude's Discretion

- Processing purpose taxonomy, privacy notice content, ConsentRecord schema
- Template content structure, cross-border transfer detection logic

## Deferred Ideas

None — discussion stayed within phase scope.
