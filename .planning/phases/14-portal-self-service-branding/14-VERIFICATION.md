---
phase: 14-portal-self-service-branding
verified: 2026-03-23T20:30:00Z
status: gaps_found
score: 9/10 must-haves verified
re_verification: false
gaps:
  - truth: "Portal displays org's logo, brand colors, and custom subdomain or path so contractors see a white-labeled experience"
    status: partial
    reason: "Logo and brand color injection are fully implemented. Custom subdomain/path routing (D-10) — {slug}.portal.app.com or custom domain via CNAME — was defined in the phase decisions but was not implemented in any plan or any code. Success criterion 3 explicitly names 'custom subdomain or path' and no routing, DNS, or middleware for this exists."
    artifacts:
      - path: "packages/db/prisma/schema/organization.prisma"
        issue: "No portalDomain, portalSubdomain, or customDomain field added to Organization model"
      - path: "apps/web/src/middleware.ts (or equivalent)"
        issue: "No subdomain-routing middleware exists for portal subdomain resolution"
    missing:
      - "Organization model field for custom subdomain/domain (e.g., portalSubdomain or customDomain)"
      - "Next.js middleware or routing logic to resolve {slug}.portal.app.com → correct org's portal"
      - "Admin UI to configure custom subdomain/domain"
      - "If descoped from Phase 14 this gap must be tracked (D-10 was listed as in-scope but zero code was produced for it)"
  - truth: "Wave 0 test stubs created per VALIDATION.md contract"
    status: failed
    reason: "VALIDATION.md required test stubs at packages/api/src/__tests__/ for portal-profile.test.ts, portal-notification-prefs.test.ts, and portal-branding.test.ts as Wave 0 before execution. None of these files exist. No test coverage for any Phase 14 API functionality was produced."
    artifacts:
      - path: "packages/api/src/__tests__/portal-profile.test.ts"
        issue: "File does not exist"
      - path: "packages/api/src/__tests__/portal-notification-prefs.test.ts"
        issue: "File does not exist"
      - path: "packages/api/src/__tests__/portal-branding.test.ts"
        issue: "File does not exist"
    missing:
      - "Unit tests for PORT-06a: updateContactInfo"
      - "Unit tests for PORT-06b: createChangeRequest (including duplicate guard)"
      - "Unit tests for PORT-06c: approveChangeRequest (transactional)"
      - "Unit tests for PORT-07a: getNotificationPreferences (defaults for missing rows)"
      - "Unit tests for PORT-07b: updateNotificationPreference"
      - "Unit tests for PORT-07c: SECURITY_ALERTS immutability guard"
      - "Unit tests for PORT-08a: updateBranding hex validation"
human_verification:
  - test: "Brand color CSS custom property injection"
    expected: "Navigating to portal as a contractor of an org with a brand color set should show --brand-accent property on the root portal div. Buttons and links in the portal should visually reflect the accent color."
    why_human: "Requires browser render verification. Cannot confirm CSS cascade from --brand-accent to visible UI elements programmatically."
  - test: "No CSS injection when brand color is not set"
    expected: "Portal should use the default theme (no --brand-accent CSS custom property present on root div) when org has no brand color configured."
    why_human: "Requires browser render verification."
  - test: "Optimistic notification toggle rollback"
    expected: "Toggling a notification preference while the network request fails should roll back the toggle to its previous state and display a toast error."
    why_human: "Requires simulating a network failure during mutation; cannot verify rollback path programmatically."
  - test: "Financial change request pending banner"
    expected: "After a contractor submits a financial change request, the Financial Details section should show the PendingChangeBanner with the submission date. Expanding 'View submitted changes' should list the changed fields."
    why_human: "Requires an end-to-end interaction with a live database record."
---

# Phase 14: Portal Self-Service & Branding Verification Report

**Phase Goal:** Contractors can manage their own profile and preferences, and the portal reflects the hiring org's brand
**Verified:** 2026-03-23
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Portal router exposes getProfile, updateContactInfo, submitFinancialChangeRequest, getNotificationPreferences, updateNotificationPreference, getOrgBranding | ✓ VERIFIED | All 6 endpoints present in `packages/api/src/routers/portal.ts` lines 926–1211 |
| 2 | Financial field edits create a ContractorChangeRequest (not direct update) per D-01 | ✓ VERIFIED | `submitFinancialChangeRequest` calls `createChangeRequest` service; billing profile is NOT directly updated |
| 3 | Contact info updates take effect immediately per D-01 | ✓ VERIFIED | `updateContactInfo` calls `prisma.contractor.update` directly, no approval gate |
| 4 | Notification preferences return 5 categories with defaults for missing rows per D-06 | ✓ VERIFIED | `getNotificationPreferences` maps all 5 CATEGORIES with `existingMap.get(category) ?? true` |
| 5 | Security alerts category cannot be toggled off per D-07 | ✓ VERIFIED | `updateNotificationPreference` throws TRPCError BAD_REQUEST when `category === "SECURITY_ALERTS" && !input.emailEnabled` |
| 6 | Admin can approve/reject change requests with optional comment per D-02, D-03 | ✓ VERIFIED | `reviewChangeRequest` in settings router delegates to `approveChangeRequest`/`rejectChangeRequest` service with comment param |
| 7 | Admin can save org brand color and logo URL per D-09 | ✓ VERIFIED | `updateBranding` in settings router merges brandColor into settingsJson and updates org.logo |
| 8 | Only bankAccountMasked is exposed to portal — never bankAccountEncrypted | ✓ VERIFIED | `getProfile` billing profile select explicitly lists `bankAccountMasked`, `bankName`, `swiftBic`, `taxId` — `bankAccountEncrypted` is absent. Lines 954–960. |
| 9 | Portal layout injects --brand-accent CSS custom property when org has brandColor set per D-12 | ✓ VERIFIED | `apps/web/src/app/[locale]/(portal)/layout.tsx` extracts `settings.brandColor` from settingsJson and sets `{ '--brand-accent': brandColor }` on the root wrapper div |
| 10 | Portal displays org's logo, brand colors, and custom subdomain or path | ✗ FAILED | Logo (org.logo) and brand color (--brand-accent) are implemented. Custom subdomain/path routing (D-10) — defined as in-scope decision — has zero implementation. No Organization field, no middleware, no admin UI for domain configuration. |

**Score:** 9/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/prisma/schema/portal.prisma` | ContractorChangeRequest and ContractorNotificationPreference models | ✓ VERIFIED | Both models present with all specified fields, indexes, and enum |
| `packages/api/src/services/portal-change-request.ts` | Exports createChangeRequest, approveChangeRequest, rejectChangeRequest | ✓ VERIFIED | All 3 functions exported with duplicate guard and $transaction in approve |
| `packages/api/src/routers/portal.ts` | Extended portal router with getProfile and 5 more endpoints | ✓ VERIFIED | Contains getProfile, updateContactInfo, submitFinancialChangeRequest, getNotificationPreferences, updateNotificationPreference, getOrgBranding |
| `packages/api/src/routers/settings.ts` | Admin branding save and change request review endpoints | ✓ VERIFIED | Contains updateBranding (with hex regex), listChangeRequests, reviewChangeRequest, getBranding, getLogoUploadUrl |
| `apps/web/src/app/[locale]/(portal)/settings/page.tsx` | Portal settings route page | ✓ VERIFIED | Exists, imports and renders PortalSettingsPage |
| `apps/web/src/components/portal/portal-settings-page.tsx` | Settings page with 3 collapsible sections | ✓ VERIFIED | Contains PortalSettingsPage, queries trpc.portal.getProfile, renders Personal Information + Financial Details + NotificationPreferencesSection, max-w-[640px] container |
| `apps/web/src/components/portal/profile-section.tsx` | Reusable collapsible section with view/edit toggle | ✓ VERIFIED | Exports ProfileSection with useForm, Collapsible, ChevronDown rotate-180, Edit Section button, Save Changes / Discard Changes, Requires Approval badge, approval info banner |
| `apps/web/src/components/portal/pending-change-banner.tsx` | Warning banner for pending financial changes | ✓ VERIFIED | Exports PendingChangeBanner with Clock icon, "Changes Pending Approval" heading, "View submitted changes" collapsible |
| `apps/web/src/components/portal/notification-preferences-section.tsx` | 5 toggle rows with optimistic update | ✓ VERIFIED | Exports NotificationPreferencesSection with 5 categories, Switch toggles, onMutate/onError rollback, locked SECURITY_ALERTS with disabled prop |
| `apps/web/src/app/[locale]/(portal)/layout.tsx` | CSS custom property injection for brand color | ✓ VERIFIED | Selects settingsJson, extracts brandColor, injects --brand-accent in style prop |
| `apps/web/src/components/settings/admin-branding-section.tsx` | Portal Branding card in admin settings | ✓ VERIFIED | Exports AdminBrandingSection with logo upload (R2), BrandColorPicker, BrandPreviewStrip, updateBranding mutation, toast "Portal branding updated" |
| `apps/web/src/components/settings/brand-color-picker.tsx` | 8-swatch + hex color picker popover | ✓ VERIFIED | Exports BrandColorPicker with all 8 hex swatches, Popover, hex validation /^#[0-9a-fA-F]{6}$/ |
| `apps/web/src/components/settings/brand-preview-strip.tsx` | Live preview of selected brand color | ✓ VERIFIED | Exports BrandPreviewStrip with "Sample Button" and "Sample Link" rendered in color |
| `apps/web/src/components/settings/change-request-diff-card.tsx` | Admin change request review card with diff table | ✓ VERIFIED | Exports ChangeRequestDiffCard with "Profile Change Request", diff table (Field/Current/Requested), "Approve Changes", "Reject Changes", Dialog "Reject Change Request", Textarea, "Confirm Rejection", reviewChangeRequest mutation |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/api/src/routers/portal.ts` | `packages/api/src/services/portal-change-request.ts` | import and call createChangeRequest | ✓ WIRED | Line 25: `import { createChangeRequest }`, called at line 1090 in submitFinancialChangeRequest |
| `packages/api/src/routers/settings.ts` | `packages/api/src/services/portal-change-request.ts` | import and call approveChangeRequest/rejectChangeRequest | ✓ WIRED | approveChangeRequest called at line 388, rejectChangeRequest at line 395 in reviewChangeRequest |
| `apps/web/src/components/portal/portal-settings-page.tsx` | `trpc.portal.getProfile` | tRPC query hook | ✓ WIRED | `useQuery(trpc.portal.getProfile.queryOptions())` at line 52 |
| `apps/web/src/components/portal/notification-preferences-section.tsx` | `trpc.portal.updateNotificationPreference` | tRPC mutation with optimistic update | ✓ WIRED | mutationFn extracted from `trpc.portal.updateNotificationPreference.mutationOptions()`, called in `updatePref.mutate()` with onMutate/onError/onSettled |
| `apps/web/src/app/[locale]/(portal)/layout.tsx` | `Organization.settingsJson.brandColor` | prisma query in server component | ✓ WIRED | `prisma.organization.findUnique` selects `settingsJson: true`, extracts `settings.brandColor`, injects into style prop |
| `apps/web/src/components/settings/admin-branding-section.tsx` | `trpc.settings.updateBranding` | tRPC mutation | ✓ WIRED | `useMutation(trpc.settings.updateBranding.mutationOptions(...))` called in handleSave |
| `apps/web/src/components/settings/change-request-diff-card.tsx` | `trpc.settings.reviewChangeRequest` | tRPC mutation | ✓ WIRED | Two useMutation calls for approve and reject, both calling `trpc.settings.reviewChangeRequest.mutationOptions(...)` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PORT-06 | 14-01, 14-02, 14-03 | Contractor can edit own profile (bank details, tax info, contact) with org approval | ✓ SATISFIED | Contact edit (immediate): updateContactInfo endpoint + ProfileSection UI wired. Financial edit (approval): submitFinancialChangeRequest + ContractorChangeRequest model + admin reviewChangeRequest. PendingChangeBanner shows pending state. |
| PORT-07 | 14-01, 14-02 | Contractor can configure notification email preferences | ✓ SATISFIED | getNotificationPreferences returns 5 categories with defaults. updateNotificationPreference upserts with SECURITY_ALERTS guard. NotificationPreferencesSection with 5 toggles, optimistic updates, locked security alerts. |
| PORT-08 | 14-01, 14-03 | Portal displays org branding (logo, colors, custom subdomain/path) | ✗ PARTIALLY SATISFIED | Logo rendered in PortalTopBar via layout.tsx. Brand color injected as --brand-accent CSS custom property. Admin can configure both via AdminBrandingSection. Custom subdomain/path routing (D-10) not implemented — the "{slug}.portal.app.com" and CNAME/Vercel custom domain parts of this requirement have no corresponding code. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/api/src/routers/portal.ts` | 1070 | `requestedChanges.bankAccountEncrypted = cleaned` stores raw (whitespace-stripped) account number — not encrypted — as `bankAccountEncrypted` | ⚠️ Warning | Misleading field name. SUMMARY confirms this is intentional ("Followed existing bank account pattern — whitespace-stripped storage") but the field name implies encryption which does not occur. Not a blocker for phase goal but a security naming concern. |

No TODO/FIXME/placeholder/stub patterns found in any Phase 14 produced files. All components render real data. All API endpoints query real Prisma models. No empty return stubs found.

---

### Human Verification Required

#### 1. Brand color CSS custom property in browser

**Test:** Log in as a contractor whose organization has a brand color set. Open browser DevTools and inspect the root portal `<div>` for `--brand-accent` CSS custom property.
**Expected:** The `--brand-accent` property is present with the org's configured hex color. Portal UI elements using `var(--brand-accent)` render in that color.
**Why human:** CSS custom property inheritance and visual rendering cannot be verified with grep.

#### 2. No CSS injection without brand color configured

**Test:** Log in as a contractor of an org with no brand color configured. Inspect the portal root div.
**Expected:** No `--brand-accent` CSS custom property is present. The portal uses the default theme colors.
**Why human:** Requires live render verification.

#### 3. Optimistic notification toggle rollback under network failure

**Test:** Simulate a network failure (DevTools → offline) and attempt to toggle a notification category.
**Expected:** The toggle snaps back to its previous state and a toast error "Failed to update preference. Please try again." appears.
**Why human:** Requires network failure simulation in a running browser.

#### 4. Financial change request end-to-end flow

**Test:** Submit a financial change request as a contractor, then log in as an admin. Navigate to Approvals → Profile Changes tab. Verify the diff card appears with current vs requested values. Approve the request. Log back in as contractor and verify the Financial Details section shows the new values without a pending banner.
**Expected:** Full approve flow works end-to-end with database state correctly updated.
**Why human:** Requires live session state, database reads, and UI rendering across two user roles.

---

### Gaps Summary

**Gap 1 — Custom subdomain/path routing (PORT-08 partial)**

Success criterion 3 states: "Portal displays the org's logo, brand colors, and **custom subdomain or path** so contractors see a white-labeled experience." Decision D-10 in CONTEXT.md explicitly scoped this as in-scope: "{slug}.portal.app.com as default, plus full custom domain support via CNAME + Vercel custom domains API."

Zero code was produced for this:
- No `portalSubdomain` or `customDomain` field on the Organization model
- No Next.js middleware for subdomain-based tenant resolution
- No admin UI for domain configuration
- No Vercel API integration for custom domain provisioning

The logo and brand color parts of PORT-08 are complete. The subdomain/path routing part was specified but skipped entirely. This requires a plan to either implement subdomain routing or formally descope D-10 from Phase 14 and defer to a later phase.

**Gap 2 — Missing test coverage**

VALIDATION.md established a Wave 0 contract requiring test stubs before execution at:
- `packages/api/src/__tests__/portal-profile.test.ts`
- `packages/api/src/__tests__/portal-notification-prefs.test.ts`
- `packages/api/src/__tests__/portal-branding.test.ts`

None of these files exist. The existing test suite has no coverage for any Phase 14 API endpoints or service functions. Key behaviors with no test coverage:
- Duplicate PENDING change request guard (createChangeRequest)
- Transactional approval applying billing profile changes
- Notification preference defaults for missing rows
- SECURITY_ALERTS immutability enforcement
- Hex color regex validation on updateBranding

These are not blockers for running the app, but the phase's own validation contract was not fulfilled.

---

*Verified: 2026-03-23*
*Verifier: Claude (gsd-verifier)*
