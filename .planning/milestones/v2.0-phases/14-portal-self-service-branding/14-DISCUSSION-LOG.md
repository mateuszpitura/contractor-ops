# Phase 14: Portal Self-Service & Branding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 14-portal-self-service-branding
**Areas discussed:** Profile edit & approval flow, Notification preferences, Org branding & white-label, Profile page layout

---

## Profile Edit & Approval Flow

### Which fields require org approval?

| Option | Description | Selected |
|--------|-------------|----------|
| Financial only | Bank details + tax ID require approval. Contact info takes effect immediately | ✓ |
| All profile changes | Everything goes through approval — bank, tax, contact, address | |
| Nothing needs approval | All changes take effect immediately | |

**User's choice:** Financial only
**Notes:** Reduces friction for low-risk changes while maintaining control over financial data

### Approval flow on admin side?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline diff review | Admin sees pending change with old → new diff in approval queue | ✓ |
| Separate change request page | Dedicated page listing all pending profile changes | |
| Email notification only | Admin gets notified and edits contractor profile manually | |

**User's choice:** Inline diff review
**Notes:** Integrates with existing approval queue

### Contractor pending UX?

| Option | Description | Selected |
|--------|-------------|----------|
| Banner + old values shown | Current values display, banner shows pending changes | ✓ |
| Optimistic display | Show new values with 'pending' badge | |
| Edit locked until resolved | Fields read-only while change pending | |

**User's choice:** Banner + old values shown

### Approval chain type?

| Option | Description | Selected |
|--------|-------------|----------|
| Simple single-approver | Any admin/manager can approve, no multi-level chain | ✓ |
| Reuse approval chains | Route through org's configured approval chain | |

**User's choice:** Simple single-approver

---

## Notification Preferences

### Notification categories?

| Option | Description | Selected |
|--------|-------------|----------|
| 5 core categories | Invoice status, payments, contracts, documents, security | ✓ |
| 3 simple groups | Financial, Contracts & docs, Security | |
| Per-event granular | Every individual event type gets its own toggle | |

**User's choice:** 5 core categories

### Notification channels?

| Option | Description | Selected |
|--------|-------------|----------|
| Email only | Simple email toggle per category | ✓ |
| Email + in-app | Email plus notification bell in portal | |
| Email + in-app + digest | Full channel support with digest option | |

**User's choice:** Email only

---

## Org Branding & White-Label

### Branding depth?

| Option | Description | Selected |
|--------|-------------|----------|
| Logo + accent color | Logo in top bar, accent color on buttons/links | ✓ |
| Full theme customization | Logo, colors, font, favicon | |
| Logo only | Just logo in top bar | |

**User's choice:** Logo + accent color

### URL branding?

| Option | Description | Selected |
|--------|-------------|----------|
| Org slug path | portal.app.com/{org-slug} | |
| Custom subdomain | {org-slug}.portal.app.com | ✓ (then upgraded to custom domain) |
| No URL branding | Generic /portal path | |

**User's choice:** Custom subdomain — then upgraded to full custom domain support

### Custom domain depth?

| Option | Description | Selected |
|--------|-------------|----------|
| Platform subdomain only | {slug}.portal.domain.com with wildcard cert | |
| Custom domain support | Orgs can CNAME their own domain with per-domain SSL | ✓ |

**User's choice:** Custom domain support (premium feature)

### Admin branding configuration?

| Option | Description | Selected |
|--------|-------------|----------|
| Existing org settings | Add Portal Branding section to org settings | ✓ |
| Dedicated branding page | Separate /settings/portal-branding page | |

**User's choice:** Existing org settings

---

## Profile Page Layout

### Layout organization?

| Option | Description | Selected |
|--------|-------------|----------|
| Single page with sections | Collapsible sections: Personal, Financial, Notifications | ✓ |
| Tabbed layout | Top tabs for each section | |
| Sidebar settings | Left nav with section links | |

**User's choice:** Single page with sections

### Edit flow?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline edit mode | Fields become editable in-place | ✓ |
| Slide-out drawer | Drawer panel with edit form | |
| Dedicated edit page | Navigate to separate edit page | |

**User's choice:** Inline edit mode

### Read-only fields?

| Option | Description | Selected |
|--------|-------------|----------|
| Contract terms + org assignment | Can see but not edit org, contract details, rates | ✓ |
| Minimal read-only | Only org assignment locked | |
| Most fields read-only | Only bank details and notif prefs editable | |

**User's choice:** Contract terms + org assignment

---

## Claude's Discretion

- Form validation rules and error messages
- Notification category labels and descriptions
- Color picker component choice
- Pending change request card design
- Inline edit animation/transition
- Empty states
- Branding preview in admin settings

## Deferred Ideas

None — discussion stayed within phase scope.
