# Passthrough Container Audit — POST refactor (2026-05-26)

Read-only re-audit of `apps/web-vite/src/components/**/*-container.tsx` after 6 refactor batches lifting hook-flag branches into containers across 32 domains. Compares to baseline at `goals/web-vite-container-pattern/passthrough-audit.md` (2026-05-25).

## Summary

| Domain | Total | Lift | Annotated | Passthrough | Ambiguous |
|--------|------:|-----:|----------:|------------:|----------:|
| (root) | 1 | 0 | 1 | 0 | 0 |
| admin | 7 | 1 | 6 | 0 | 0 |
| approvals | 4 | 4 | 0 | 0 | 0 |
| auth | 4 | 0 | 0 | 4 | 0 |
| billing | 6 | 2 | 1 | 2 | 1 |
| classification | 2 | 2 | 0 | 0 | 0 |
| consent | 1 | 1 | 0 | 0 | 0 |
| contractors | 39 | 15 | 21 | 2 | 1 |
| contracts | 11 | 9 | 0 | 1 | 1 |
| dashboard | 1 | 1 | 0 | 0 | 0 |
| documents | 4 | 1 | 2 | 1 | 0 |
| einvoice | 2 | 2 | 0 | 0 | 0 |
| equipment | 11 | 3 | 8 | 0 | 0 |
| import | 1 | 0 | 0 | 1 | 0 |
| integrations | 16 | 8 | 6 | 2 | 0 |
| invoices | 24 | 17 | 1 | 5 | 1 |
| layout | 7 | 5 | 0 | 2 | 0 |
| legal | 6 | 0 | 1 | 5 | 0 |
| notifications | 2 | 1 | 1 | 0 | 0 |
| ocr | 1 | 0 | 0 | 1 | 0 |
| onboarding | 6 | 0 | 0 | 6 | 0 |
| organization | 10 | 6 | 4 | 0 | 0 |
| payments | 10 | 7 | 2 | 0 | 1 |
| peppol | 3 | 3 | 0 | 0 | 0 |
| portal | 20 | 13 | 3 | 1 | 3 |
| reports | 1 | 1 | 0 | 0 | 0 |
| search | 1 | 0 | 0 | 1 | 0 |
| settings | 63 | 7 | 55 | 1 | 0 |
| shared | 1 | 0 | 0 | 1 | 0 |
| time | 4 | 3 | 1 | 0 | 0 |
| workflows | 20 | 11 | 2 | 6 | 1 |
| zatca | 13 | 11 | 2 | 0 | 0 |
| **TOTAL** | **302** | **134** | **117** | **42** | **9** |

## Comparison to baseline (2026-05-25 audit)

| Metric | Before | After | Delta |
|--------|-------:|------:|------:|
| Total containers | 301 | 302 | +1 |
| Lift (decisive without comment) | 77 | 134 | +57 |
| Annotated (decisive via comment) | 0 | 117 | +117 |
| Passthrough | 215 | 42 | -173 |
| Ambiguous | 3 | 9 | +6 |

**Net decisive (Lift + Annotated): 251 / 302 = 83%** (was 25%).

## Remaining passthroughs (refactor candidates)

### onboarding (6)
- `apps/web-vite/src/components/onboarding/confirm-import-step-container.tsx`
- `apps/web-vite/src/components/onboarding/import-progress-tracker-container.tsx`
- `apps/web-vite/src/components/onboarding/onboarding-import-container.tsx`
- `apps/web-vite/src/components/onboarding/people-review-step-container.tsx`
- `apps/web-vite/src/components/onboarding/project-import-step-container.tsx`
- `apps/web-vite/src/components/onboarding/source-selection-step-container.tsx`

### workflows (6)
- `apps/web-vite/src/components/workflows/template-builder/task-card-container.tsx`
- `apps/web-vite/src/components/workflows/template-builder/template-form-container.tsx`
- `apps/web-vite/src/components/workflows/template-picker-container.tsx`
- `apps/web-vite/src/components/workflows/workflow-run/run-header-container.tsx`
- `apps/web-vite/src/components/workflows/workflow-runs-table/data-table-container.tsx`
- `apps/web-vite/src/components/workflows/workflow-side-panel-container.tsx`

### invoices (5)
- `apps/web-vite/src/components/invoices/einvoice-tab/download-zugferd-pdf-button-container.tsx`
- `apps/web-vite/src/components/invoices/intake/intake-detail-actions-bar-container.tsx`
- `apps/web-vite/src/components/invoices/intake/intake-detail-validation-pane-container.tsx`
- `apps/web-vite/src/components/invoices/intake/intake-upload-dialog-container.tsx`
- `apps/web-vite/src/components/invoices/invoice-upload-area-container.tsx`

### legal (5)
- `apps/web-vite/src/components/legal/legal-breach-notification-container.tsx`
- `apps/web-vite/src/components/legal/legal-privacy-container.tsx`
- `apps/web-vite/src/components/legal/legal-privacy-jurisdiction-container.tsx`
- `apps/web-vite/src/components/legal/legal-sub-processors-container.tsx`
- `apps/web-vite/src/components/legal/legal-terms-container.tsx`

### auth (4)
- `apps/web-vite/src/components/auth/auth-invite-container.tsx`
- `apps/web-vite/src/components/auth/auth-login-container.tsx`
- `apps/web-vite/src/components/auth/auth-register-container.tsx`
- `apps/web-vite/src/components/auth/auth-verify-email-container.tsx`

### billing (2)
- `apps/web-vite/src/components/billing/feature-gate-container.tsx`
- `apps/web-vite/src/components/billing/usage-dashboard-container.tsx`

### contractors (2)
- `apps/web-vite/src/components/contractors/classification/wizard/classification-wizard-shell-container.tsx`
- `apps/web-vite/src/components/contractors/country-compliance-section-container.tsx`

### integrations (2)
- `apps/web-vite/src/components/integrations/linear-task-config-container.tsx`
- `apps/web-vite/src/components/integrations/teams-channel-mapping-card-container.tsx`

### layout (2)
- `apps/web-vite/src/components/layout/portal-shell-container.tsx`
- `apps/web-vite/src/components/layout/top-bar-container.tsx`

### contracts (1)
- `apps/web-vite/src/components/contracts/contract-detail/overview-tab-container.tsx`

### documents (1)
- `apps/web-vite/src/components/documents/document-list-container.tsx`

### import (1)
- `apps/web-vite/src/components/import/import-wizard-dialog-container.tsx`

### ocr (1)
- `apps/web-vite/src/components/ocr/ocr-review-panel-container.tsx`

### portal (1)
- `apps/web-vite/src/components/portal/portal-equipment-container.tsx`

### search (1)
- `apps/web-vite/src/components/search/command-palette-container.tsx`

### settings (1)
- `apps/web-vite/src/components/settings/settings-calendar-container.tsx`

### shared (1)
- `apps/web-vite/src/components/shared/unauthorized-container.tsx`

## Remaining ambiguous

### billing
- `apps/web-vite/src/components/billing/billing-tab-container.tsx` — ternary-jsx.

### contractors
- `apps/web-vite/src/components/contractors/contractor-profile/tab-payments-container.tsx` — ternary-jsx.

### contracts
- `apps/web-vite/src/components/contracts/contract-detail/amendments-tab-container.tsx` — ternary-jsx.

### invoices
- `apps/web-vite/src/components/invoices/intake/intake-list-container.tsx` — ternary-jsx.

### payments
- `apps/web-vite/src/components/payments/new-payment-run-dialog/step-select-container.tsx` — ternary-jsx.

### portal
- `apps/web-vite/src/components/portal/portal-contracts-container.tsx` — ternary-jsx.
- `apps/web-vite/src/components/portal/portal-payments-container.tsx` — ternary-jsx.
- `apps/web-vite/src/components/portal/portal-settings-container.tsx` — ternary-jsx.

### workflows
- `apps/web-vite/src/components/workflows/workflow-run/task-comments-container.tsx` — ternary-jsx.

## Notes

- Containers scanned: **302**.
- Baseline counted 301 containers; current tree has 302 (delta +1).
- Top 3 domains by remaining passthroughs: **onboarding** (6), **workflows** (6), **invoices** (5).
- The refactor reclassified the bulk of the 215 baseline passthroughs into either explicit `// Decision:` / `/** Decisive: */` annotations (annotated bucket, +117 from 0) or true hook-flag-driven branches lifted into the container body (`Suspense`, `<Navigate>`, `usePermissions`, `if (…) return`, logical render, composition with state).
- Settings domain dominates annotated bucket (55/63) — bulk-comment pattern documenting external gating contracts on dialog/form hosts.
- Remaining ambiguous containers all share the `return <X /> ? variantA : variantB` ternary pattern at the JSX root — these should be folded into `if (…) return` or single-view variant pick to flip into DECISIVE-LIFT.
- Remaining passthroughs cluster in: legal (static i18n pages with no hook layer — questionably containers at all), auth (thin route wrappers), onboarding (step components passed external state), workflows builder (form-section passthroughs around RHF). These are the highest-value refactor / re-annotate targets.
- No containers regressed: every container previously classified as DECISIVE-LIFT still carries at least one structural decision trigger.
