# Portal UI Polish

## Goal

Elevate every contractor-facing portal route under `apps/web/src/app/[locale]/(portal)/` to production-grade visual and interaction quality: consistent layout/spacing, polished navigation, illustration-backed empty states, skeleton loading, org branding wired through (logo + brandColor), in-session org switching for multi-org contractors, full RTL support, mobile parity, and zero serious axe violations.

## Shared Understanding

See [facts.md](./facts.md) — the testable list of outcomes this goal must produce.

## Execution Plan

See [plan.md](./plan.md) — ordered steps, files touched, verification per step, risks.

## Done

- Every fact in `facts.md` verifiable on a running dev server across `en` / `de` / `pl` / `ar` at 360 / 768 / 1280 px.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` green.
- `jest-axe` portal suite reports 0 violations (impact ≥ serious).
- Multi-org seed contractor can switch orgs via the profile dropdown on desktop and via the mobile sheet.
