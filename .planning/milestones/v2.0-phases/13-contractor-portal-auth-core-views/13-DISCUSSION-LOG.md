# Phase 13: Contractor Portal Auth & Core Views - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 13-contractor-portal-auth-core-views
**Areas discussed:** Portal layout & navigation, Invoice submission experience, Status & payment tracking, Session & access model

---

## Portal Layout & Navigation

### Navigation style

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal top bar | Logo + org name left, nav links center, profile right. Clean, focused | ✓ |
| Slim sidebar | Narrow sidebar with icons + labels, like admin but simpler | |
| Tab-based | Horizontal tabs below header bar | |

**User's choice:** Minimal top bar
**Notes:** Contractors have ~5 sections max, no need for sidebar complexity

### Landing page

| Option | Description | Selected |
|--------|-------------|----------|
| Overview dashboard | Summary cards: active contracts, pending invoices, recent payments, deadlines | ✓ |
| Invoice list | Land directly on invoices — most common action | |
| Activity feed | Chronological feed of recent events | |

**User's choice:** Overview dashboard
**Notes:** None

### Mobile handling

| Option | Description | Selected |
|--------|-------------|----------|
| Responsive down to mobile | Top bar collapses to hamburger on 375px+ | ✓ |
| Tablet minimum (1024px) | Same as admin dashboard | |
| Mobile-first | Design mobile layout first | |

**User's choice:** Responsive down to mobile
**Notes:** Contractors check payment status from phone

### Visual tone

| Option | Description | Selected |
|--------|-------------|----------|
| Same design system, lighter | Reuse shadcn/ui, same colors, simpler layouts | ✓ |
| Distinct portal look | Different color scheme/typography | |
| Identical to admin | Exact same components and density | |

**User's choice:** Same design system, lighter
**Notes:** None

---

## Invoice Submission Experience

### Metadata level

| Option | Description | Selected |
|--------|-------------|----------|
| Upload PDF + minimal fields | Invoice number, issue date, due date, net amount, gross amount | ✓ |
| Upload PDF only | All metadata on org side | |
| Full metadata entry | Same fields as internal invoice form | |

**User's choice:** Upload PDF + minimal fields
**Notes:** None

### Batch upload

| Option | Description | Selected |
|--------|-------------|----------|
| Single invoice at a time | One PDF + metadata per submission | ✓ |
| Multi-file batch | Upload multiple PDFs, enter metadata for each | |
| You decide | Claude's discretion | |

**User's choice:** Single invoice at a time
**Notes:** Contractors typically submit 1 invoice/month

### Contract linking

| Option | Description | Selected |
|--------|-------------|----------|
| Contractor picks contract | Dropdown of active contracts, pre-fills expected amounts | ✓ |
| Auto-match by org | Org's NIP-based matching handles it | |
| Optional selection | Can pick but doesn't have to | |

**User's choice:** Contractor picks contract
**Notes:** Auto-select if only 1 active contract

### Confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Success toast + redirect | Toast confirms, redirects to invoice detail | |
| Success page with summary | Dedicated confirmation page with summary and next steps | ✓ |
| You decide | Claude's discretion | |

**User's choice:** Success page with summary
**Notes:** None

---

## Status & Payment Tracking

### Status display

| Option | Description | Selected |
|--------|-------------|----------|
| Status timeline per invoice | Horizontal step indicator on detail page | ✓ (all three) |
| Simple status badge | Colored badge on invoice list | ✓ (all three) |
| Detailed activity log | Chronological log of events | ✓ (all three) |

**User's choice:** All three — status timeline on detail, badges on list, activity log
**Notes:** User explicitly wanted all three layers, not just one

### Activity log filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Filtered — contractor-relevant only | Show submitted, reviewed, approved, paid. Hide internal details | ✓ |
| Full transparency | Show all events including internal reviewer assignments | |

**User's choice:** Filtered — contractor-relevant only
**Notes:** None

### Payment details

| Option | Description | Selected |
|--------|-------------|----------|
| Payment date + amount only | No internal batch IDs or org bank details | ✓ |
| Full payment details | Date, amount, bank reference, batch ID | |
| Payment date + expected date | Shows expected payment date from contract terms | |

**User's choice:** Payment date + amount only
**Notes:** None

---

## Session & Access Model

### Session duration

| Option | Description | Selected |
|--------|-------------|----------|
| 7 days | Week-long sessions, reduce friction for occasional checking | ✓ |
| 24 hours | Same as admin dashboard | |
| 30 days | Maximum convenience | |

**User's choice:** 7 days
**Notes:** Portal is read-heavy, lower security risk than admin

### Multi-org handling

| Option | Description | Selected |
|--------|-------------|----------|
| Separate magic links per org | Each org sends own link, separate sessions | |
| Org picker after login | Single magic link, pick org if multiple | ✓ |
| You decide | Claude's discretion | |

**User's choice:** Org picker after login
**Notes:** Link contractor records across orgs by email

### Magic link trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Org invites + contractor self-request | Admin sends link OR contractor requests from public login page | ✓ |
| Org-initiated only | Only admins can send access links | |
| Self-service only | Public login page, no admin action needed | |

**User's choice:** Org invites + contractor self-request
**Notes:** None

---

## Claude's Discretion

- Overview dashboard card layout and metrics
- Invoice form field validation rules
- Status timeline component design
- Activity log entry formatting
- Mobile hamburger menu behavior
- Empty states for all sections
- Loading skeletons
- Public login page layout

## Deferred Ideas

None — discussion stayed within phase scope.
