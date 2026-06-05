---
status: partial
phase: 80-v6-0-verification-hardening-manual-uat
source: [80-VERIFICATION.md]
started: 2026-06-03
updated: 2026-06-03
---

## Current Test

[awaiting human testing — requires running the app with every v6.0 feature flag enabled
(`compliance-payment-block`, `compliance-policy-engine.*`, `compliance-portal-self-service`,
`offboarding-ip-foundation`, `gulf.free-zone-tracking`, `gulf.saudization-dashboard`,
`module.idp-deprovisioning-{gws,slack,entra,okta,github}`) plus the deferred EU+ME region
migrations applied. Every result is `[pending]`: LOCAL-ONLY posture means no human runs this
checklist until non-local deploy — these are post-deploy dispositions, never phase/milestone blockers.]

## Tests

### 1. F1 — At-risk compliance dashboard widgets render

expected: (1) Enable `compliance-payment-block` + `compliance-policy-engine.*`; seed an org with one
contractor holding a BLOCKING+EXPIRED compliance item and one with a 7-day-window expiring item.
(2) Open the admin compliance dashboard (`apps/web-vite/.../compliance/dashboard/compliance-dashboard-container.tsx`).
(3) Verify the KPI cards (`compliance-kpi-cards.tsx`) render the at-risk contractor count, expiring-soon
count, and blocked count with correct figures; loading skeleton (`compliance-dashboard-skeleton.tsx`)
shows first, then data; empty state appears for an org with zero items. (4) The drilldown deep-links
from each card resolve to the matching filtered contractor list.
why_human: Live widget render, KPI count accuracy against seeded data, skeleton→data transition, and
empty-state copy cannot be grep-verified — only the query shape is unit-tested, not the rendered figures.
result: [pending]

### 2. F1 — Payment-block PRECONDITION_FAILED modal lists per-contractor reasons with deep link

expected: (1) Open a LOCKED payment run that includes a contractor with a BLOCKING+EXPIRED compliance
item. (2) Attempt to advance/export → server raises `PRECONDITION_FAILED` with
`cause.contractorReasons`; the `payment-block-modal.tsx` opens. (3) Verify one collapsible section per
blocked contractor (D-10), each listing the expired BLOCKING documents; each row carries an
`ExternalLink` deep link (locale-aware TanStack Router `Link`) into the contractor's compliance item.
(4) Keyboard nav reaches every accordion trigger + the close button; focus is trapped in the dialog;
verify the mirrored layout in `ar` (RTL) with no physical-direction leakage.
why_human: Structured-error → dialog flow, per-contractor accordion expansion, deep-link navigation,
keyboard/focus trapping, and RTL mirroring are interaction + visual concerns grep cannot prove.
result: [pending]

### 3. F1 — Portal one-click upload-replacement flips item to SATISFIED

expected: (1) As the contractor, magic-link into the portal; the home compliance banner
(`portal-home-compliance-banner.tsx`) surfaces the expired/at-risk item. (2) Open the portal compliance
list (`portal-compliance-list.tsx`) and use the upload-replacement form
(`portal-upload-replacement-form.tsx`) to upload a fresh document. (3) After admin approval of the
replacement, verify the `ContractorComplianceItem` flips to SATISFIED and the contractor disappears from
the payment-block modal on the next payment-run attempt. (4) Confirm the upload virus-scan + signed-URL
round-trip succeeds.
why_human: End-to-end magic-link portal flow, file upload to R2, signed-URL behaviour, and the
admin-approval → SATISFIED state flip span a running server with real storage — not unit-testable.
result: [pending]

### 4. F1 — Manual override → WAIVED writes a visible audit row

expected: (1) On a contractor's compliance tab, open the override dialog
(`override-compliance-item-dialog.tsx` via `override-compliance-item-button.tsx`). (2) Submit an override
with a reason category + note. (3) Verify the item moves to WAIVED, the
`compliance-item-history.tsx` timeline shows the override entry with actor + reason, and an audit row
(`writeAuditLog`) is recorded for the override action. (4) Verify a non-privileged role does not see the
override button.
why_human: Dialog submission flow, history-timeline render, the audit-row appearing in the UI history,
and role-gated button absence are visual/interaction concerns; the mutation is unit-tested but not the
rendered audit-trail surface.
result: [pending]

### 5. F2 (IdP) — ACCESS_REVOKE per-IdP describeImpact preview before deprovision

expected: (1) Enable the relevant `module.idp-deprovisioning-*` flags and connect at least one IdP for
the org. (2) From an offboarded contractor (offboarding COMPLETE, post final-invoice cooldown), trigger
the ACCESS_REVOKE saga and open the deprovisioning run view (`idp/deprovisioning-run-view.tsx`). (3)
Before any deprovision step executes, verify each provider step shows a `describeImpact` preview (the
`ImpactPreview` payload) listing what will be revoked per IdP. (4) Confirm the override-step dialog
(`idp/override-step-dialog.tsx`) is reachable for a step that needs manual intervention.
why_human: The pre-deprovision impact preview render and the run-view step lifecycle are live UI; the
`ImpactPreview` union is type-checked but its rendered per-provider preview cannot be grep-verified.
F2 is the ONLY milestone-close coverage for the IdP feature — it is deliberately excluded from the SC#1
cross-feature integration test (D-01: the ACCESS_REVOKE saga runs only AFTER offboarding completes, off
the hard-blocked path, so it cannot compose into the blocked-offboarding scenario).
result: [pending]

### 6. F2 (IdP) — Google Workspace: suspend + OAuth-revoke + sign-out

expected: Against a GWS sandbox (MSW or real test tenant), run the GWS deprovision step and verify the
account is suspended, all OAuth grants are revoked, and active sessions are signed out;
`verifyDeprovisioned` confirms the end state and the provenance row is written. Re-run the GWS adapter
toggle in the settings toggle table (`settings/idp-deprovisioning-toggle-table.tsx`) and confirm the
per-provider enable state persists.
why_human: Real-provider (GWS Admin SDK) suspend + token-revoke + session-clear side effects can only be
exercised against a live/sandbox tenant; unit tests mock the Admin SDK.
result: [pending]

### 7. F2 (IdP) — Slack: session-invalidate + SCIM-deactivate

expected: Run the Slack deprovision step against a Slack sandbox; verify the user's sessions are
invalidated and the SCIM record is deactivated; `verifyDeprovisioned` confirms; provenance row written.
why_human: Slack SCIM + session-invalidation are real-API side effects requiring a sandbox workspace.
result: [pending]

### 8. F2 (IdP) — Entra: disable + revokeSignInSessions with Conditional-Access + hybrid-AD warnings

expected: Run the Entra/Microsoft 365 deprovision step; verify the account is disabled and
`revokeSignInSessions` clears active tokens. (1) Confirm a Conditional-Access **pre-flight warning** is
surfaced before the step runs when CA policies could interfere. (2) Confirm a **hybrid-AD hard-warning**
appears for a hybrid-joined directory (on-prem AD writeback means the cloud disable may be reverted by
sync) — the step must surface this prominently, not silently proceed.
why_human: The CA pre-flight warning and hybrid-AD hard-warning are conditional UI/flow branches that
depend on the live tenant's directory configuration; grep cannot prove the warning renders for the right
tenant shape.
result: [pending]

### 9. F2 (IdP) — Okta: deactivate + session-clear

expected: Run the Okta deprovision step against an Okta sandbox; verify the user is deactivated and all
sessions are cleared; `verifyDeprovisioned` confirms; provenance row written.
why_human: Okta deactivate + session-clear are real-API side effects requiring a sandbox org.
result: [pending]

### 10. F2 (IdP) — GitHub: member-remove + per-PAT-revoke + outside-collaborator manual flag

expected: Run the GitHub deprovision step against a GitHub org sandbox; verify the org member is removed
and each personal-access-token is revoked. Confirm that an **outside collaborator** (not an org member)
is surfaced as a **manual-flag** item — the saga must not silently assume membership-removal covers
outside collaborators; it raises a manual reconcile flag instead.
why_human: The outside-collaborator manual-flag branch depends on the real org's membership graph; the
per-PAT revocation and the manual-flag surfacing need a live org to exercise.
result: [pending]

### 11. F2 (IdP) — PARTIAL_FAILURE reconcile-queue manual retry

expected: Force one provider step to fail (e.g. transient API error) so the run lands in
PARTIAL_FAILURE. (1) Verify the failed step appears in the reconcile queue in the run view
(`idp/deprovisioning-run-view.tsx`) with a manual-retry affordance. (2) Trigger manual retry; verify the
step re-runs and, on success, the run status recomputes (deriveRunStatus) to the correct terminal state.
why_human: The PARTIAL_FAILURE → reconcile-queue → manual-retry → status-recompute lifecycle is a live
multi-step UI flow; the pure status-derivation is unit-tested but not the queued-retry interaction.
result: [pending]

### 12. F2 (IdP) — Idempotent second click returns LIKELY_GONE

expected: After a successful deprovision, click the deprovision/retry action a second time for the same
provider+user. Verify the saga returns LIKELY_GONE (the user is already absent at the provider) rather
than erroring or double-revoking; the run view reflects the idempotent outcome.
why_human: Idempotency against a real provider's "already-gone" response shape can only be confirmed
against a live/sandbox tenant after a real first revoke.
result: [pending]

### 13. F3 — Arabic RTL visual on every Gulf surface

expected: In the `ar` locale, verify correct RTL mirroring on: the free-zone assignment form
(`contractors/free-zone/free-zone-assignment-form.tsx`), the scope-mismatch banner
(`scope-mismatch-banner.tsx`), the Saudization dashboard incl. the reversed band donut
(`saudization/saudization-dashboard.tsx`), the Nitaqat override dialog (`nitaqat-override-dialog.tsx`),
and the offboarding-trajectory banner (`saudization/offboarding-trajectory-banner.tsx`). No bidi break,
no physical-direction leakage; chart axis/direction via `useRtlChartConfig`. **Cross-reference:** this
is the milestone-level roll-up of `79-HUMAN-UAT.md` test 1 — `check:rtl-logical-props` passes (14
surfaces, 0 offenders) but cannot verify actual visual render.
why_human: `check:rtl-logical-props` proves logical CSS only; actual mirrored render, donut reversal, and
absence of bidi breakage are visual.
result: [pending]

### 14. F3 — Free-zone form + scope-mismatch advisory + auto-NOC

expected: (1) On a UAE contractor, open the free-zone assignment form and assign a free zone with a
permitted-activity catalogue. (2) Enter an engagement scope that falls outside the zone's permitted
activities; verify the `scope-mismatch-banner.tsx` advisory appears (advisory, non-blocking) naming the
mismatch. (3) Verify the auto-NOC affordance surfaces where the zone requires a No-Objection
Certificate. (4) Confirm the license-expiry monitoring reflects the entered expiry date.
why_human: The advisory-banner trigger logic against catalogue data, the auto-NOC surfacing, and the
form's expiry handling are interaction/visual flows; only the underlying derivation is unit-tested.
result: [pending]

### 15. F3 — Saudization dashboard rollup + manual band entry + drift-override badge

expected: (1) Open the Saudization dashboard for a KSA org; verify the band, Saudization rate, Qiwa-auth
gap, and Iqama rollup compute correctly from seeded headcount. (2) Use the config dialog
(`saudization-config-dialog.tsx`) for manual band entry. (3) Apply a Nitaqat threshold / activity
catalogue override via `nitaqat-override-dialog.tsx`; verify the overridden value shows the
"Custom — verify with adviser" `--warning` badge and writes an audit row. (4) Confirm the dashboard never
asserts an authoritative band where the data is advisory.
why_human: Rollup figure accuracy, the manual-entry flow, and the custom-override warning-badge render
are visual/interaction concerns; the override audit row is unit-tested but the badge render is not.
result: [pending]

### 16. F3 — Pre-offboarding band-trajectory advisory banner

expected: When offboarding a Saudi-national contractor from a KSA org, verify the offboarding-trajectory
banner (`saudization/offboarding-trajectory-banner.tsx`) renders the projected post-offboarding
Saudization-rate trajectory as an **advisory** (authoritative:false), recomputing the projected rate but
**never** asserting a projected band (the locked anti-feature). The banner must not block offboarding.
why_human: The advisory banner render + the explicit absence of a projected-band claim are visual; the
`projectOffboardingTrajectory` pure function is unit-tested (advisory:true / authoritative:false) but the
rendered banner is not.
result: [pending]

### 17. F3 — German / Polish Gulf translation genuineness

expected: All `Contractors.freeZone.*` and `Saudization.*` keys in `de.json` / `pl.json` are genuine
translations (D-16), not English placeholders; a de/pl speaker confirms wording quality. **Cross-reference:**
this restates `79-HUMAN-UAT.md` test 2 at the milestone level — `i18n:parity` confirms key existence
only; the heuristic flags only proper-noun zone names as en-identical (expected).
why_human: Translation quality is a human-language judgement the parity guard cannot make.
result: [pending]

### 18. F4 — KT template auto-select + PTO-aware routing

expected: (1) Start an offboarding for a contractor whose role maps to a knowledge-transfer template.
Verify the correct KT template is auto-selected from the template picker
(`workflows/template-picker-dialog.tsx`). (2) Confirm task assignment is PTO-aware: where an assignee is
marked out-of-office (`settings/out-of-office-section.tsx`), KT tasks route to an available alternate
rather than the OOO assignee.
why_human: Template auto-selection by role and PTO-aware routing are runtime assignment decisions
depending on seeded role mappings + OOO state; the rendered picker selection and the routed assignee are
not grep-verifiable.
result: [pending]

### 19. F4 — OWNER-only IP-verification override dialog (min-20-char reason + acknowledgement)

expected: (1) As OWNER, attempt to complete an offboarding run blocked by an open IP_VERIFICATION task;
the override dialog (`offboarding/override-dialog.tsx`) opens. (2) Verify the reason field enforces a
live minimum of 20 characters and the acknowledgement checkbox must be ticked before submit enables; ESC
with a dirty form prompts a discard AlertDialog. (3) Submit and confirm the run completes with an audit
row (`workflow.offboarding.override_blocking_task`). (4) As a **non-OWNER** role, verify the override
button/dialog is **not present** at all.
why_human: Live min-length validation, the acknowledgement gate, the dirty-ESC discard flow, and the
role-gated button absence are interaction/visual concerns grep cannot prove; the mutation is unit-tested
but not the gated UI.
result: [pending]

### 20. F4 — IP-clause LIKELY_MISSING surfaces a STANDARD item + e-sign ratification flow

expected: (1) Run a contract health check on a contract whose IP-assignment language is absent; verify
the result is `LIKELY_MISSING` and materialises a STANDARD `ContractorComplianceItem`. (2) From that
item, start the IP-ratification e-sign flow (`workflow/ip-verification-esign-button.tsx`); verify the
ratification document is sent for signature and, on signing-completion webhook, the item flips to
SATISFIED and the offboarding IP gate clears. (Note: per STATE.md, the real e-sign send + atomic webhook
flip are a DEFERRED follow-up slice — confirm whichever portion is wired; the button is presentational +
wired-by-prop.)
why_human: The health-check verdict render, the e-sign send + signing round-trip, and the webhook-driven
SATISFIED flip span a running server + e-sign provider; only the health-check classification is unit-tested.
result: [pending]

### 21. F4 — CredentialReference: pasting an AWS key is rejected

expected: (1) Open the credential add dialog (`workflow/credential-add-dialog.tsx`) for a documentation
handover task. (2) Paste a value that looks like an AWS secret access key into the label or vault-URL
field; verify the client-side `looksLikeSecret` check disables submit and shows instant feedback. (3)
Bypass the client (e.g. direct API call) and confirm the server `looksLikeSecretRefinement` rejects the
mutation with `400` / BAD_REQUEST — the vault stores references, never raw secrets.
why_human: The client instant-feedback render + the server-side 400 rejection on a bypassed payload need
a running server; the refinement is unit-tested but the dialog feedback render is not.
result: [pending]

## Summary

total: 21
passed: 0
issues: 0
pending: 21
skipped: 0
blocked: 0

## Gaps
