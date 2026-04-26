---
phase: 64
status: issues_found
depth: standard
files_reviewed: 48
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
reviewed_at: "2026-04-26T01:30:00.000Z"
---

# Code Review — Phase 64: Legal Compliance Hardening

## Summary

48 source files reviewed at standard depth. 1 critical issue (broken `'use client'` directive placement that prevents React hooks from working), 3 warnings, 2 info findings.

---

## Critical Issues

### CR-01: `'use client'` directive preceded by comments in verdict-banner.tsx

**File:** `apps/web/src/components/contractors/classification/outcome/verdict-banner.tsx`  
**Lines:** 1–11

**Issue:** The `'use client'` directive appears on line 11, after 9 lines of block comments. In Next.js App Router, `'use client'` must be the **first statement** in the file — it must precede all imports, comments, and any other code. When comments appear first, bundlers may not recognize the directive, causing the component to be treated as a Server Component and the `useEffect`/`useRef` hooks to throw at runtime.

**Impact:** The `onAmberVerdictMounted` escalation hook added in Plan 64-06 uses `useEffect` and `useRef`. If the directive is not recognized, this will throw a React server-component error on any classification outcome page showing an amber verdict.

**Fix:** Move `'use client';` to be the absolute first line of the file, before any comments:

```typescript
'use client';
// ---------------------------------------------------------------------------
// Shared verdict banner — Phase 58 Plan 05 Task 1.
// ...
```

---

## Warnings

### WR-01: CLASSIFICATION_ENABLED evaluated at module load — stale until server restart

**File:** `packages/api/src/root.ts`  
**Lines:** 89–107

**Issue:** `CLASSIFICATION_ENABLED = ClassificationFlagBag.isEnabled('module.classification-engine')` is evaluated once at module load time. The conditional spread in `appRouter` is computed at startup and never re-evaluated. This means toggling the flag in Unleash has no effect until the Node.js process restarts. The plan notes this in a comment, but operators may not be aware — they could toggle Unleash, see it reflected in the admin status page (which re-evaluates per request), but find the procedures remain absent/present from the router.

**Recommendation:** Add a comment in the admin status page (64-09) explaining this server-restart requirement, or consider registering classification routers unconditionally and relying solely on `classificationProcedure` middleware for the kill-switch (defense-in-depth is already present). The middleware check re-evaluates per request.

**Risk:** Operator confusion, not a security issue — the per-request middleware still blocks calls.

---

### WR-02: drv-clearance-panel uploads with empty `user` param in `uploadedAt` message

**File:** `apps/web/src/components/contractors/classification/drv-clearance/drv-clearance-panel.tsx`  
**Line:** 167

**Issue:** After upload succeeds, the success message calls `tDrv('uploadedAt', { date: ..., user: '' })`. The `user` interpolation parameter is always empty string. The i18n message is `"Uploaded {date} by {user}"` — this will render as "Uploaded 26/04/2026 by " with a trailing space.

**Fix:** Either drop the `by {user}` from the message when user is unknown, or resolve the uploader's name (available from `session.user.name` if the component had access to it via a prop).

---

### WR-03: Classification layout.tsx issues an additional `prisma.organization.findFirst` query per classification page render

**Files:** `apps/web/src/app/[locale]/(dashboard)/classification/layout.tsx` (and the two sibling layout files)

**Issue:** Each classification route layout queries `prisma.organization.findFirst` to get `countryCode` and `dataRegion` for flag evaluation. The parent `(dashboard)/layout.tsx` already fetched organization data (but only `id`, `name`, `slug`, `logo`, `dataRegion`, `countryCode`). Because Next.js server components don't share context between layouts in the same render, this results in a duplicate DB query on every classification page load.

**Recommendation:** This is an acceptable performance trade-off given the current architecture (no shared context mechanism), but consider using React cache or a per-request cache store if this becomes a bottleneck. Not blocking.

---

## Info

### INFO-01: `ctx.user?.id ?? ''` is overly defensive in approveSds / logEscalation

**File:** `packages/api/src/routers/classification.ts`  
**Lines:** 591, 639

**Issue:** `classificationProcedure` chains from `authedProcedure`, which guarantees `ctx.user` is non-null (throws `UNAUTHORIZED` if absent). The `?? ''` fallback can never fire. Using an empty string as a userId would create a DB record with no user association — worse than throwing.

**Recommendation:** Use `ctx.user.id` directly (non-optional). Low priority — functionally correct since the fallback never triggers.

---

### INFO-02: `window.location.reload()` in TosReacceptanceModal is a hard navigation

**File:** `apps/web/src/components/tos-reacceptance-modal.tsx`  
**Line:** ~57

**Issue:** After ToS acceptance, the modal calls `window.location.reload()` to force a layout re-query. This is a full page reload, discarding any client-side state. A softer approach (`router.refresh()` from `next/navigation`) would re-run server components without discarding client state.

**Recommendation:** Consider using `useRouter().refresh()` instead. Low priority for MVP.

---

## Self-Check

- No `console.*` calls in source files (uses pino/createLogger) ✓
- No hardcoded Unleash URLs or API tokens in source files ✓
- CLASSIFICATION_ENGINE_DISABLED error code is distinct from generic auth failures ✓
- signoff-registry.json validation at module load (fail-fast) ✓
- SDS_NOT_APPROVED guard added server-side (defense-in-depth preserved) ✓
- Non-dismissible modal (ESC disabled, click-outside disabled, no close button) ✓
- All external links in expert-help page use rel="noopener noreferrer" ✓
- File upload MIME magic byte validation + 10MB cap in server mutation ✓
- Admin status page is read-only (no toggle buttons) ✓
