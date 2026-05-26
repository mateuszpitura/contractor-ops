# Passthrough Container Audit — FINAL (2026-05-26)

Read-only final re-audit of `apps/web-vite/src/components/**/*-container.tsx` after refactor batches R1–R6, R8a–R8d, R9. Compares to the baseline (`passthrough-audit.md`, 2026-05-25) and the post-R1-R6 snapshot (`passthrough-audit-post.md`, 2026-05-26).

Classification rule (same as prior audits):

- **DECISIVE-LIFT** — body has `if (…) return`, `<Suspense>`, `<Navigate>` / nav-effect, variant pick (`let body: ReactNode; if/else`), conditional sub-component (`{cond && <X />}`), step-dispatch, or `usePermissions` / `useFlag` driving render branch.
- **DECISIVE-ANNOTATED** — `// Decision:` / `/** Decisive: */` comment justifying the gate.
- **PASSTHROUGH** — no decision, no comment, no branch.
- **AMBIGUOUS** — single ternary at JSX root only.

## Summary

| Domain | Total | Lift | Annotated | Passthrough | Ambiguous |
|--------|------:|-----:|----------:|------------:|----------:|
| (root) | 1 | 1 | 0 | 0 | 0 |
| admin | 7 | 2 | 5 | 0 | 0 |
| approvals | 4 | 4 | 0 | 0 | 0 |
| auth | 4 | 0 | 4 | 0 | 0 |
| billing | 6 | 5 | 1 | 0 | 0 |
| classification | 2 | 2 | 0 | 0 | 0 |
| consent | 1 | 1 | 0 | 0 | 0 |
| contractors | 39 | 18 | 21 | 0 | 0 |
| contracts | 11 | 9 | 0 | 1 | 1 |
| dashboard | 1 | 1 | 0 | 0 | 0 |
| documents | 4 | 4 | 0 | 0 | 0 |
| einvoice | 2 | 2 | 0 | 0 | 0 |
| equipment | 11 | 3 | 8 | 0 | 0 |
| import | 1 | 0 | 1 | 0 | 0 |
| integrations | 16 | 9 | 7 | 0 | 0 |
| invoices | 24 | 18 | 5 | 0 | 1 |
| layout | 7 | 6 | 1 | 0 | 0 |
| legal | 6 | 0 | 6 | 0 | 0 |
| notifications | 2 | 2 | 0 | 0 | 0 |
| ocr | 1 | 0 | 1 | 0 | 0 |
| onboarding | 6 | 6 | 0 | 0 | 0 |
| organization | 10 | 6 | 4 | 0 | 0 |
| payments | 10 | 8 | 2 | 0 | 0 |
| peppol | 3 | 3 | 0 | 0 | 0 |
| portal | 20 | 16 | 3 | 1 | 0 |
| reports | 1 | 1 | 0 | 0 | 0 |
| search | 1 | 1 | 0 | 0 | 0 |
| settings | 63 | 15 | 48 | 0 | 0 |
| shared | 1 | 0 | 1 | 0 | 0 |
| time | 4 | 3 | 1 | 0 | 0 |
| workflows | 20 | 14 | 6 | 0 | 0 |
| zatca | 13 | 11 | 2 | 0 | 0 |
| **TOTAL** | **302** | **171** | **127** | **2** | **2** |

**Net decisive (Lift + Annotated): 298 / 302 = 98.7%** (was 25% at baseline, 83% post-R1-R6).

## Three-way comparison

| Metric | Baseline (2026-05-25) | Post R1–R6 | Final (post R8 + R9) | Delta vs baseline |
|--------|----------------------:|-----------:|---------------------:|------------------:|
| Total containers | 301 | 302 | 302 | +1 |
| Lift (decisive without comment) | 77 | 134 | 171 | +94 |
| Annotated (decisive via comment) | 0 | 117 | 127 | +127 |
| Passthrough | 215 | 42 | 2 | -213 |
| Ambiguous | 3 | 9 | 2 | -1 |
| Decisive share | 25% | 83% | 98.7% | +73.7 pp |

## Remaining passthroughs (2)

### contracts
- `apps/web-vite/src/components/contracts/contract-detail/signing-progress-bar-container.tsx` — composes `SigningProgressBar` + `SigningAuditTrail` + `VoidEnvelopeDialog` side-by-side off one hook (`useSigningProgressBarPanel`); no branch, no flag — pure multi-child composition. Annotation is the practical ceiling (composition note documenting the bundled trio + shared hook state).

### portal
- `apps/web-vite/src/components/portal/portal-invoice-submit-container.tsx` — back-link + heading layout chrome wrapping `InvoiceSubmitFormContainer`. No decision logic; layout-only. Annotation is the practical ceiling.

## Remaining ambiguous (2)

### contracts
- `apps/web-vite/src/components/contracts/contract-detail/overview-tab-container.tsx` — single `reminders.editing ? <Editing> : <Display>` variant via local var, threaded into `OverviewTab` as `remindersEditor` prop. Single ternary; could flip to DECISIVE-LIFT by promoting to `if (reminders.editing) return …` or by annotating the variant pick as the container's decision.

### invoices
- `apps/web-vite/src/components/invoices/intake/intake-upload-dialog-container.tsx` — single `upload.localError ? <ErrorBlock> : <Dropzone>` variant via local var threaded as `body` prop. Same shape as above; promote to `if` or annotate.

## Notes

- Containers scanned: **302**.
- Container count is unchanged from the post-R1–R6 snapshot (302); no new containers added in R8/R9.
- **R8 + R9 net effect:** 40 of the 42 remaining post-R1–R6 passthroughs were converted (17 lifted into branching bodies, 23 annotated with `// Decision:` / `/** Decisive: */` blocks). 7 of 9 ambiguous (single-ternary) containers were lifted into explicit branches or annotated. The only remaining passthroughs are 2 genuinely-branch-free composition / layout shells; the only remaining ambiguous are 2 single-ternary variant picks that are borderline by definition.
- **Annotation as ceiling:** legal (6/6 annotated), auth (4/4 annotated), settings (48/63 annotated) — domains dominated by static i18n pages, thin route wrappers, and Card-scaffolded mutation hosts where the decision *is* the comment.
- **Lift-dominant domains:** approvals, classification, consent, dashboard, documents, einvoice, notifications, onboarding, peppol, reports, search — every container has a structural branch.
- No regressions: every container previously classified DECISIVE-LIFT in the post-R1–R6 audit still carries at least one structural decision trigger.
- Top remaining passthrough domains: contracts (1), portal (1) — both candidates for a 2-line annotation comment rather than a code lift, since neither holds branching logic to surface.
