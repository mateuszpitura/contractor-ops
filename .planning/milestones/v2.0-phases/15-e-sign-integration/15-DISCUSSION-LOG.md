# Phase 15: E-Sign Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 15-e-sign-integration
**Areas discussed:** Provider priority, Signing experience, Send-for-signature trigger, Multi-party signing order

---

## Provider Priority

| Option | Description | Selected |
|--------|-------------|----------|
| DocuSign first | Largest market share, most mature API, well-documented. Autenti adapter added later. | |
| Autenti first | Polish market focus, may be more relevant for contractor base. | |
| Both simultaneously | Build provider-agnostic abstraction from day one, implement both adapters in parallel. | ✓ |

**User's choice:** Both simultaneously
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| One provider per org | Admin picks DocuSign OR Autenti in settings. Simpler UX. | |
| Per-contract choice | Admin connects both, picks provider when sending for signature. | ✓ |
| Per-contract with org default | Admin sets default provider, can override per contract. | |

**User's choice:** Per-contract choice
**Notes:** None

---

## Signing Experience

| Option | Description | Selected |
|--------|-------------|----------|
| Embedded signing | DocuSign/Autenti signing view in iframe/modal within app. | |
| Redirect flow | Signer redirected to provider's own signing page. | |
| Embedded with redirect fallback | Try embedded first, fall back to redirect if not supported. | ✓ |

**User's choice:** Embedded with redirect fallback
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Portal signing | Contractor signs from portal dashboard. | |
| Email link only | Signing via email link from provider. | |
| Both — portal + email | Contractor can sign from portal OR email link. Email as fallback. | ✓ |

**User's choice:** Both — portal + email
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Full-page modal | Document fills screen for readability. Close returns to contract detail. | ✓ |
| Side panel | Signing view in side panel alongside contract details. | |
| New tab | Opens in new browser tab. | |

**User's choice:** Full-page modal
**Notes:** None

---

## Send-for-Signature Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Contract detail action button | "Send for Signature" on contract header. | |
| Documents tab action | Per-document action in Documents tab. | |
| Both — header + per-document | Header sends main contract PDF, Documents tab sends individual documents. | ✓ |

**User's choice:** Both — header + per-document
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal setup | Provider picker, signer list, message, Send button. | |
| Full setup with preview | Provider picker, signers, message, document preview with signature markers, expiry, reminders. | ✓ |
| Wizard flow | Multi-step: select doc, add signers, place fields, review & send. | |

**User's choice:** Full setup with preview
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Contract status update | Contract moves to "Pending Signature", returns to "Active" when signed. | ✓ |
| Separate signing tracker | Contract status unchanged, separate entity tracks signing. | |
| Both — status + tracker | Status reflects signing phase AND separate SigningRequest entity. | |

**User's choice:** Contract status update
**Notes:** None

---

## Multi-Party Signing Order

| Option | Description | Selected |
|--------|-------------|----------|
| Sequential with default order | Contractor first, org rep countersigns. Admin can reorder. | ✓ |
| Fully configurable | Arbitrary signing groups and order with parallel sub-groups. | |
| Parallel only | All signers receive simultaneously, sign in any order. | |

**User's choice:** Sequential with default order
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Admin picks from org members | Dropdown of org members in setup dialog. | ✓ |
| Role-based auto-assign | Auto-assign based on "Contract Signer" role. | |
| Contract owner auto-assigned | Creator/owner of contract is countersigner. | |

**User's choice:** Admin picks from org members
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Status update + notification | Status moves to Declined/Expired, admin notified. | ✓ |
| Auto-void and re-send option | Expired envelopes auto-voided, re-send action available. | |
| Manual handling only | System shows status, no automatic action. | |

**User's choice:** Status update + notification
**Notes:** None

---

## Claude's Discretion

- Provider-agnostic abstraction layer design
- Webhook event processing for signing status updates
- Signature field placement strategy
- Signing audit trail storage schema
- Portal pending signatures UI
- Notification templates for signing events

## Deferred Ideas

None — discussion stayed within phase scope
