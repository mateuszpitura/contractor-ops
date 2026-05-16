# Accessibility — WCAG 2.2 AA Self-Attestation

**Status:** Active gate as of Phase C.4 (2026-05-16).
**Compliance target:** WCAG 2.2 Level AA (covers 2.0/2.1 AA inclusively).
**Owner:** Platform team — contact via [`/.well-known/security.txt`](../apps/web/src/app/.well-known/security.txt/route.ts) for accessibility-impacting security issues, or open a GitHub issue tagged `a11y` for non-urgent reports.

## Scope

This attestation covers the authenticated dashboard surface of the `@contractor-ops/web` application: the top-10 routes that account for the majority of user time-on-task.

| Route          | Surface                                  |
| -------------- | ---------------------------------------- |
| `/dashboard`   | KPI overview + activity stream           |
| `/contractors` | Contractor list + create flow            |
| `/contracts`   | Contract list + lifecycle actions        |
| `/invoices`    | Invoice list + detail + skonto + e-invoice |
| `/payments`    | Payment runs + reconciliation            |
| `/approvals`   | Approval queue + side panel              |
| `/equipment`   | Equipment register + assignments         |
| `/workflows`   | Workflow templates + automation rules    |
| `/settings`    | Org / billing / integrations             |
| `/admin`       | Admin console + audit log                |

The marketing landing app (`@contractor-ops/landing`) and the contractor portal are tracked separately and will join the gate in a follow-up phase.

## Automated tooling

- **Engine:** [`@axe-core/playwright`](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright) — the same `axe-core` rule set that powers Deque's commercial axe DevTools.
- **Runtime:** Playwright project `a11y` defined in [`apps/web/playwright.functional.config.ts`](../apps/web/playwright.functional.config.ts).
- **Spec:** [`apps/web/e2e/a11y/dashboard-routes.spec.ts`](../apps/web/e2e/a11y/dashboard-routes.spec.ts).
- **Rule tags evaluated:** `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.
- **Failure threshold:** any violation with `impact` of `serious` or `critical` fails the test unless allowlisted (see below).
- **Local run:** `pnpm --filter=@contractor-ops/web run test:a11y`
- **CI gate:** GitHub Actions job `e2e-a11y` in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). Runs on every pull request and every push to `main`/`v2`. Uploads the Playwright HTML report as a build artifact on failure (`playwright-a11y-report`, 14-day retention) so reviewers can inspect violations without re-running the suite locally.

## Allowlist policy

Known violations live in [`.axe-allowlist.json`](../.axe-allowlist.json) at the repo root.

**Shape:**

```jsonc
{
  "/dashboard": [
    { "id": "color-contrast", "expiresAt": "2026-08-14", "note": "FOUND7-12 — pending design refresh" }
  ]
}
```

**Rules:**

1. Every entry **must** carry an `expiresAt` ISO-date string.
2. `expiresAt` **must** be ≤ 90 days from the date the entry was added. Entries with a later expiry must be justified in the PR description.
3. Expired entries are automatically ignored by the spec — i.e. an expired allowlist row hardens back into a CI failure. Allowlist debt cannot rot.
4. The allowlist is **sweeped monthly** by the platform team: expired rows are deleted, still-blocked rows trigger a fix-or-renew decision recorded in the sweep PR.
5. New entries require a `note` citing the tracking issue or ADR. Anonymous allowlisting is rejected at review.

## Current backlog

At Phase C.4 introduction (2026-05-16) the allowlist is empty (`{}`). First real CI run against the dashboard surface is expected to seed it; that PR will land with each entry's `expiresAt` set to the 90-day max and an attached remediation owner.

## Manual audit cadence

Automated scans catch ~30–40 % of WCAG issues. The following are evaluated on a **quarterly** cadence by the platform team, results recorded in `docs/audits/a11y-YYYY-QN.md`:

- **Keyboard-only navigation** of every flow in the top-10 surface.
- **Screen reader** smoke test with NVDA (Windows) + VoiceOver (macOS) on dashboard, contractor create, invoice detail, approval action, settings.
- **High-contrast mode** rendering on dashboard + invoice detail.
- **Reduced-motion** preference handling on landing-page hero + dashboard skeleton states.
- **Zoom to 200 %** without horizontal scroll on the top-5 routes.
- **Form-error semantics** — every required field has both a visual marker and an `aria-required` / `aria-invalid` programmatic equivalent.
- **Focus-trap audit** of every modal, sheet, popover, and command palette.

External audit (third-party WCAG 2.2 AA conformance review) is scheduled annually and tracked in `docs/AUDIT-INDEX.md`.

## Reporting an accessibility issue

- **Security-adjacent issues** (e.g. accessibility regressions that block a user from completing a security-sensitive flow such as 2FA enrolment): use the contact in [`.well-known/security.txt`](../apps/web/src/app/.well-known/security.txt/route.ts).
- **Other a11y issues:** open a GitHub issue with the `a11y` label, including (a) the route, (b) the assistive technology / browser, (c) the WCAG success criterion if known, (d) reproduction steps.

We aim to acknowledge within **2 business days** and to ship a fix for `serious`/`critical` issues within **2 weeks**, in line with the EAA (Directive (EU) 2019/882) operational guidance the project follows.

## Change log

- **2026-05-16 — Phase C.4:** axe-core gate introduced. Allowlist seeded empty.
