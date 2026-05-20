# Goal — shadcn ecosystem integration

Integrate the free shadcn ecosystem (shadcn/ui blocks, Magic UI, Aceternity, Cult UI, Origin UI, Tailark, ReUI, shadcn.io, 21st.dev) across `apps/landing` (marketing + blog), `apps/web` (dashboard), `apps/cms` (Payload), and the shared `packages/ui` package. Wire the shadcn + 21st.dev MCP servers so Claude installs community blocks via description, then ship a comprehensive set of polished pages and upgrades — community-first, no recurring cost.

## Shared understanding

See [`facts.md`](./facts.md) for the testable fact sheet (foundation, MCP, libraries, landing pages, blog architecture, Payload schema, web dashboard, quality bars, out of scope).

## Execution plan

See [`plan.md`](./plan.md) for the five-wave plan (Foundation → Landing → Blog → Web upgrades → Hardening), file-level steps, verification gates, and risk register.

## Done condition

- All five waves shipped and merged.
- `pnpm typecheck && pnpm build && pnpm test && pnpm e2e` all green at repo root.
- Lighthouse ≥ 90 (Performance + Accessibility) on every new landing and blog route.
- All new pages render in `en`, `de`, `pl`, `ar` with RTL verified.
- Bundle budgets respected: landing route JS ≤ baseline + 80 KB gzip, web route JS ≤ baseline + 60 KB gzip.
- shadcn + 21st.dev MCP servers configured and a developer can install a component end-to-end via natural-language prompt.
- `packages/ui/README.md` documents adopted libraries and MCP usage.
- Risk register in `plan.md` either resolved or explicitly accepted.
