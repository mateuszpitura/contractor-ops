# Phase 49: Peppol PINT-AE Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 49-Peppol PINT-AE Integration
**Areas discussed:** ASP selection & connection, Outbound invoice flow, Inbound invoice reception, UAE QR code requirements

---

## ASP Selection & Connection

| Option | Description | Selected |
|--------|-------------|----------|
| Abstract ASP adapter | Interface for provider swapping. Implement one first. | ✓ |
| Hardcode to one ASP | Pick now, build directly. | |
| You decide | Claude picks | |

**User's choice:** Abstract ASP adapter
**Notes:** Vendor selection still pending per STATE.md blocker.

| Option | Description | Selected |
|--------|-------------|----------|
| Same store (Infisical/Doppler) | Consistent with Phase 48. One pattern. | ✓ |
| DB-encrypted (existing) | API keys simpler than certs. | |
| You decide | Claude picks | |

**User's choice:** Same store (Infisical/Doppler)

---

## Outbound Invoice Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Async via QStash (like ZATCA) | Consistent pattern. QStash job for submission. | ✓ |
| Synchronous submission | Block until ASP confirms. | |
| You decide | Claude picks | |

**User's choice:** Async via QStash

---

## Inbound Invoice Reception

| Option | Description | Selected |
|--------|-------------|----------|
| Webhook from ASP | ASP pushes via webhook. Uses existing pipeline. | |
| Polling the ASP API | QStash cron polls periodically. | |
| Both (webhook + polling fallback) | Webhook primary, polling catch-up. | ✓ |
| You decide | Claude picks | |

**User's choice:** Both (webhook + polling fallback)

---

## UAE QR Code Requirements

| Option | Description | Selected |
|--------|-------------|----------|
| Shared QRCodeable hook, different encoding | Same interface, different implementation per FTA. | ✓ |
| Reuse ZATCA's TLV encoding | Share encoding if similar enough. | |
| You decide | Claude picks | |

**User's choice:** Shared QRCodeable hook, different encoding

---

## Claude's Discretion

- Participant ID registration UX
- PINT-AE XML specifics
- ASP adapter interface design
- Webhook/polling implementation details
- UAE QR data format

## Deferred Ideas

None — discussion stayed within phase scope.
