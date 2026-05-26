# Goal — Registry Component Pack

Curate a **tier-1 component pack** drawn from 7 already-configured shadcn registries (`@magic`, `@aceternity`, `@cult`, `@origin`, `@tailark`, `@reui`, `@shadcnio`) and apply it across `apps/landing` (marketing + blog) and `apps/web-vite` (product). Opinionated subset — one strongest pick per slot, not a full library import.

## Shared understanding

See [`facts.md`](./facts.md) — 22 testable facts split as **10 landing**, **4 blog**, **8 web-vite**, with explicit quality bars (a11y / RTL / i18n / motion / bundle) and out-of-scope list.

## Execution plan

See [`plan.md`](./plan.md) — five waves (Foundation → Landing hero → Landing sections → Blog → Web-vite → Re-audit), with file-level wiring steps, per-wave verification, and a 10-row risk register.

## Done condition

- All 22 tier-1 components installed under `packages/ui/src/components/<registry>/` and exported via the existing subpath barrels.
- Every wired surface in `apps/landing` and `apps/web-vite` matches the file paths called out in `facts.md`.
- `pnpm typecheck && pnpm test && pnpm --filter @contractor-ops/landing build && pnpm --filter @contractor-ops/web-vite build` all green.
- `pnpm audit && pnpm security:scan && pnpm check:no-process-env && pnpm check:web-vite-data-layer` clean.
- Lighthouse Performance + Accessibility ≥ 90 on `/`, `/pricing`, `/blog`, `/blog/[slug]` in both `en` and `ar`.
- `goals/registry-component-pack/audit.md` written, every fact marked ✓ wired (△ rows only allowed with a referenced risk-register downgrade).
- All 6 locale JSON files (`en`, `en-GB`, `de`, `pl`, `ar`, `ar-SA`) contain the new translation keys; `/ar/*` routes verified RTL.
- Every motion-using component respects `useReducedMotion`; verified by manual toggle pass.

Done! Launch a goal with `/goal goals/registry-component-pack/goal.md`
