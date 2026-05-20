# Engineering & Product Guidelines

## Session Start

- Always start session with `/caveman` command.

## Git Safety — NEVER stash without explicit user approval

- NEVER run `git stash`, `git stash --keep-index`, `git stash --include-untracked`, or any stash variant unsolicited. Other agents may work same tree without isolated worktrees — unexpected stash silently moves in-flight edits, destroys context, wastes tokens on replay.
- NEVER run `git checkout --`, `git restore`, `git reset --hard`, or any destructive op on files not created this turn, unless user authorized THIS specific op.
- Need stash/checkout/reset to test (e.g. "pre-existing error?"): STOP, ask first — describe what + why. Confirmation cheap, lost edit expensive.
- Doubt on tree state: prefer read-only diagnosis (`git status`, `git diff`, `git show`) over mutation. Never "clean up" index, stash list, tree without direct instruction.

## UI / Design

- Use `frontend-design` plugin for all UI work.
- Aim high-quality, polished, visually consistent, production-ready interfaces.
- Prioritize UX, visual hierarchy, responsiveness, accessibility, design consistency across app.
- Avoid generic or low-effort UI.

## Browser Automation

Use `agent-browser` for web automation. Run `agent-browser --help` for all commands.

Core workflow:

1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes

## Code Search

Use `semble search` to find code by describing what it does or naming a symbol/identifier, instead of grep:

```bash
semble search "authentication flow" ./my-project
semble search "save_pretrained" ./my-project
semble search "save model to disk" ./my-project --top-k 10
```

Use `semble find-related` to discover code similar to a known location (pass `file_path` and `line` from a prior search result):

```bash
semble find-related src/auth.py 42 ./my-project
```

`path` defaults to the current directory when omitted; git URLs are accepted.

If `semble` is not on `$PATH`, use `uvx --from "semble[mcp]" semble` in its place.

## Workflow

1. Start with `semble search` to find relevant chunks.
2. Inspect full files only when the returned chunk is not enough context.
3. Optionally use `semble find-related` with a promising result's `file_path` and `line` to discover related implementations.
4. Use grep only when you need exhaustive literal matches or quick confirmation of an exact string.

## Architecture

- Monorepo via Turborepo.
- Clean architecture, clear boundaries between apps, packages, domains, infrastructure.
- Apply SOLID, DRY, separation of concerns, design patterns where they improve maintainability.
- Prefer scalable, modular, extensible over short-term hacks.
- Keep codebase navigable, predictable, senior-level quality.

## Libraries / Documentation / Freshness

- Always use `ctx7` CLI for library docs, usage patterns, implementation details.
- Rely on most up-to-date stable library versions + current best practices.
- Avoid outdated patterns, deprecated APIs, legacy approaches unless required.

## Code Quality

- Clean, readable, maintainable, well-structured code.
- Strong typing, no unsafe shortcuts.
- Explicitness over magic.
- Justified abstractions, no overengineering.
- Consistent, meaningful naming.

## Validation & Data Safety

- Schema validation for all external inputs, forms, API payloads, env vars, critical boundaries.
- Never trust client input.
- Validate + sanitize at every important boundary.
- Keep frontend/backend/database contracts explicit + type-safe.

## Security

- Security best practices by default.
- No exposed secrets, internal details, sensitive data.
- Least-privilege access.
- Rate limiting, authorization, secure defaults, defensive programming.
- Prefer RLS + database-level protections.
- Consider XSS, CSRF, SSRF, injection, auth bypass, insecure direct object references, etc.

## Performance

- Consider performance, caching, efficiency from start.
- Avoid unnecessary re-renders, overfetching, duplicated computation, oversized bundles.
- Appropriate caching at API, database, frontend levels.
- Optimize DX + runtime efficiency.

## Accessibility

- Follow WCAG + a11y best practices by default.
- Keyboard nav, focus states, semantic HTML, screen-reader friendly, sufficient contrast.
- Core requirement, not polish.

## Environment / Developer Experience

- Keep `.env.example` up to date.
- Fast, predictable local setup.
- Conventions that speed onboarding + reduce config confusion.
- Clear, consistent scripts, package boundaries, workflows.

## Delivery Standard

- Production-grade, not demo-grade.
- Think senior engineer + architect + product-minded builder.
- Balance maintainability, scalability, performance, UX, security.

## Observability

- Proper logging, error handling, monitoring hooks.
- Make failures debuggable.
- No silent failures.
- Structure logs + error flows so production issues diagnose efficiently.

## API & Contracts

- Consistent, predictable, well-structured APIs.
- Clear request/response contracts.
- Design for maintainability + future evolution.
- No breaking changes unless intended.

## Database

- Careful schemas with maintainability, indexing, query perf in mind.
- Safe migrations, reversible when possible.
- No business logic leaking into random places — belongs in domain or DB layer.

## Product Thinking

- No mechanical feature implementation.
- Consider user goals, edge cases, failure states, empty states, realistic flows.
- Prefer solutions useful in real production.