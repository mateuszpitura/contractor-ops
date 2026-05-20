# Goal — QA walk-and-fix across `apps/web`, `apps/landing`, `apps/cms`

Walk every view in every state across all three apps using `agent-browser` + Playwright (+ MCP) on top of a deterministic seed, then fix everything I find — visuals, layout, console / network noise, a11y, i18n, RTL, dark theme, internal-API integration, unified component usage — until the latest walk report contains zero findings and every view / subview / modal has a captured success screenshot for human review.

## Shared understanding

See [`facts.md`](./facts.md) for the testable fact sheet (tooling, seed scope, states covered, locale matrix, chaos / "act as a human" pass, public-API parity, visual unification, a11y + i18n depth, fix scope, and explicit out-of-scope items including OCR + external integrations).

## Execution plan

See [`plan.md`](./plan.md) for the ordered eleven-step plan (seed audit → seed gap fill → fixture users → Payload seed → route registry → walk orchestrator → first walk → fix loop → chaos pass → public-API parity → final clean walk), files touched, verification per step, and the risk register.

## Done condition

- Latest `goals/qa-walk-and-fix/findings/<iso-date>/REPORT.md` has `Findings: 0` across blocker / high / medium / low severities for every walked route × state × locale × theme × viewport.
- Every walked view / subview / page / modal / dialog / dropdown / popover / sheet has a captured **success** screenshot under `goals/qa-walk-and-fix/findings/<iso-date>/screenshots/`, indexed by `SUMMARY.md` so a human can scroll through and approve the walk.
- Chaos pass passes (`pnpm qa:walk --chaos`) with no remaining findings.
- Public-API parity check passes (`pnpm qa:walk --public-api`).
- Repo gates green: `pnpm -r typecheck`, `pnpm -r build`, `pnpm -r test`, `pnpm i18n:parity`, existing Playwright `functional` + `a11y` projects.
- No secrets, tokens, passwords, or API keys appear anywhere in `goals/qa-walk-and-fix/findings/`.
- OCR pipeline and external-integration end-to-end flows are explicitly excluded (queued for the next phase).
