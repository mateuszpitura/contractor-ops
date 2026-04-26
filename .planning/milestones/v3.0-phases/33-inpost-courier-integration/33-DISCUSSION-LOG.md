# Phase 33: InPost Courier Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 33-InPost Courier Integration
**Areas discussed:** Parcel Locker selection, Status tracking approach, Contractor return flow, Label delivery

---

## Parcel Locker Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Modal with Geowidget | Full-screen or large modal with InPost's embedded Geowidget map | ✓ |
| Inline Geowidget | Embedded directly in shipment form, visible alongside fields | |
| Search + dropdown | Text autocomplete against InPost API, no map | |

**User's choice:** Modal with Geowidget
**Notes:** Clean separation from form, consistent with modern picker patterns

| Option | Description | Selected |
|--------|-------------|----------|
| Paczkomat only | InPost = Paczkomat, door delivery via DPD/UPS in Phase 35 | ✓ |
| Paczkomat + courier | Both Paczkomat and door-to-door via InPost | |
| You decide | Claude picks based on API capabilities | |

**User's choice:** Paczkomat only

| Option | Description | Selected |
|--------|-------------|----------|
| Store preferred locker | Save contractor's preferred Paczkomat, pre-fill on future shipments | ✓ |
| Pick each time | No memory, select per shipment | |
| You decide | Claude picks pragmatic approach | |

**User's choice:** Store preferred locker

| Option | Description | Selected |
|--------|-------------|----------|
| Both admin + portal | Geowidget modal available in admin panel and contractor portal | ✓ |
| Admin only | Admin picks Paczkomat for all shipments | |
| You decide | Claude picks based on EQUIP-11 scope | |

**User's choice:** Both admin + portal

---

## Status Tracking Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Webhook (push) | Register webhook with ShipX, real-time status pushes | |
| Polling (pull) | QStash scheduled task polls ShipX periodically | |
| Webhook + polling fallback | Primary webhook, hourly polling catches missed events | ✓ |
| You decide | Claude picks based on ShipX capabilities and infra | |

**User's choice:** Webhook + polling fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Every 30 minutes | Balanced API usage vs freshness | |
| Every hour | Lower API load, acceptable delay for equipment shipments | ✓ |
| You decide | Claude picks based on rate limits | |

**User's choice:** Every hour

| Option | Description | Selected |
|--------|-------------|----------|
| Key statuses only | Notify on DELIVERED, FAILED, RETURNED only | ✓ |
| All status changes | Notify on every transition | |
| You decide | Claude picks sensible triggers | |

**User's choice:** Key statuses only

---

## Contractor Return Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Equipment tab + return button | New portal tab with assigned items and return button | |
| Return via notification | Email/notification with return link on offboarding | |
| Both tab + notification | Always-visible Equipment tab plus notification link on offboarding | ✓ |

**User's choice:** Both tab + notification

| Option | Description | Selected |
|--------|-------------|----------|
| Anytime (self-service) | Contractor can return whenever via portal | |
| Offboarding only | Return only when offboarding workflow triggers it | |
| Both with approval | Self-service requires admin approval, offboarding skips approval | ✓ |

**User's choice:** Both with approval

| Option | Description | Selected |
|--------|-------------|----------|
| Select specific items | Contractor picks which items to return | |
| All assigned items | Return all assigned equipment in one shipment | ✓ |
| You decide | Claude picks based on model and patterns | |

**User's choice:** All assigned items

---

## Label Delivery

| Option | Description | Selected |
|--------|-------------|----------|
| QR code in portal + email | Portal shows QR code, also sent via email | |
| PDF label download | Downloadable PDF from portal and email | |
| You decide | Claude picks based on ShipX API for Paczkomat returns | ✓ |

**User's choice:** You decide (Claude's discretion)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, on shipment detail | Label/QR visible on admin shipment detail page with download/print | ✓ |
| Download only on creation | One-time download on creation, re-fetch from API if needed | |
| You decide | Claude picks pragmatic approach | |

**User's choice:** Yes, on shipment detail

---

## Claude's Discretion

- Label format (QR vs PDF) — based on ShipX API capabilities for Paczkomat
- CourierClient interface design (separate bounded context)
- ShipX API auth and credential storage
- Webhook signature verification
- Polling batch size and retry logic
- Return approval notification templates
- Preferred Paczkomat storage approach
- Shipment form layout
- Portal Equipment tab layout

## Deferred Ideas

None — discussion stayed within phase scope
