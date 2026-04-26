# Phase 17: KSeF Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 17-ksef-integration
**Areas discussed:** KSeF authentication, Polling & sync strategy, Invoice intake flow, Duplicate detection

---

## KSeF Authentication

| Option | Description | Selected |
|--------|-------------|----------|
| Token-based | Admin generates auth token in KSeF portal, pastes into settings. Simplest setup. | |
| Certificate upload | Admin uploads qualified e-seal certificate (.p12/.pem). More secure, complex setup. | |
| Both options | Token as primary, certificate as advanced option. More flexibility. | ✓ |

**User's choice:** Both options — token as primary path, certificate as advanced option
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Integration tab | KSeF as provider card in Settings > Integrations. Consistent with existing pattern. | ✓ |
| Dedicated KSeF section | Separate settings section with more room for KSeF-specific config. | |

**User's choice:** Integration tab — consistent with Slack/DocuSign/Autenti pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Pull from org settings | Use existing NIP from organization settings. Less duplication. | ✓ |
| Enter during KSeF setup | Dedicated NIP field in connection dialog. Allows branch NIP. | |

**User's choice:** Pull from org settings

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, verify on save | Test API call to KSeF before saving connection. | ✓ |
| No, save and sync later | Save immediately, surface auth issues on first sync. | |

**User's choice:** Verify on save

---

## Polling & Sync Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Every hour | Hourly cron via Upstash QStash. Balances freshness with rate limits. | ✓ |
| Every 15 minutes | More responsive, higher API usage. | |
| Manual trigger + daily cron | Daily auto-sync + on-demand button. Most conservative. | |

**User's choice:** Every hour

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, Sync now button | Manual trigger on KSeF provider card for on-demand pulls. | ✓ |
| No, cron only | Only automatic hourly sync. | |

**User's choice:** Yes, Sync now button

| Option | Description | Selected |
|--------|-------------|----------|
| In provider card detail | Expandable section on KSeF card with last 10 syncs. Reuses IntegrationSyncLog. | ✓ |
| Separate sync log page | Dedicated page with full filterable sync history. | |

**User's choice:** In provider card detail

---

## Invoice Intake Flow

| Option | Description | Selected |
|--------|-------------|----------|
| RECEIVED + auto-match | Same pipeline as manual uploads. Auto-matching runs immediately. | ✓ |
| UNDER_REVIEW directly | Skip RECEIVED, go straight to review. | |
| RECEIVED, match on demand | Create as RECEIVED, user triggers matching manually. | |

**User's choice:** RECEIVED + auto-match — reuses existing Phase 5 pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| Full auto-fill | All FA(3) XML fields mapped including line items, bank account, everything. | ✓ |
| Core fields only | Header fields only, skip line items and bank account. | |

**User's choice:** Full auto-fill

| Option | Description | Selected |
|--------|-------------|----------|
| Batch notification | One notification per sync: "N new invoices from KSeF". | ✓ |
| Per-invoice notification | Individual notification per invoice. | |
| No notification | Invoices appear silently. | |

**User's choice:** Batch notification

---

## Duplicate Detection

| Option | Description | Selected |
|--------|-------------|----------|
| Invoice number + seller NIP | Natural business key for Polish invoices. Most reliable cross-source. | ✓ |
| Extend existing hash | Reuse Phase 5 SHA256 hash approach across sources. | |
| Both methods | Primary on number+NIP, secondary on hash. Belt and suspenders. | |

**User's choice:** Invoice number + seller NIP

| Option | Description | Selected |
|--------|-------------|----------|
| Flag both + prefer KSeF | Link duplicates, show warnings, KSeF as authoritative. User decides. | ✓ |
| Auto-void manual upload | Automatically void manual version. Aggressive. | |
| Flag only, no preference | Show warning on both, no preference. | |

**User's choice:** Flag both + prefer KSeF

| Option | Description | Selected |
|--------|-------------|----------|
| Both places | KSeF badge in list + full metadata on detail page. | ✓ |
| Detail page only | KSeF metadata only on detail page. | |
| Badge + detail | Source badge in list + reference on detail. | |

**User's choice:** Both places — badge in list table, full metadata section on detail page

---

## Claude's Discretion

- KSeF API client implementation details
- FA(3) XML parsing approach
- KSeF-specific Invoice model fields vs reusing existing fields
- Cron scheduling within QStash
- UI details for sync button, certificate upload, duplicate linking

## Deferred Ideas

- KSeF invoice validation against structured data (v3)
- KSeF invoice sending/issuing (out of scope)
- KSeF push notifications / real-time webhooks (future)
- Auto-void of manual duplicate (too aggressive for v2)
