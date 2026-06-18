---
title: UI skills routing
type: pattern
tags: [patterns, ui, skills, frontend-design, impeccable]
updated: 2026-06-10
source_commit: 52e6f818f245fea0392da678f5c1092e4c67cfae
verify_with:
  - .cursor/rules/30-ui-a11y.mdc
  - .claude/core-values.yml
  - CLAUDE.md
  - PRODUCT.md
  - .claude/hooks/ui-workflow-lib.js
  - .claude/skills/impeccable/SKILL.md
---

# UI skills routing

> Layered skill stack for `apps/web-vite`, `apps/landing`, `packages/ui`, and portal UI. **Stack, not mutex** — load missing layers per slice; do not Read every SKILL.md each turn.

## Hierarchy

```
1. frontend-design (plugin) — binding; distinctive UI, anti-generic
2. semble search — before grep and edits
3a. impeccable — web-vite, portal, packages/ui (product register)
3b. design-taste-frontend — apps/landing / explicit marketing
4. full-output-enforcement — full page or many complete files
```

## Skill locations

| Skill | Path |
|-------|------|
| frontend-design | Claude plugin (`frontend-design@claude-plugins-official`) |
| impeccable | `.claude/skills/impeccable/SKILL.md` |
| design-taste-frontend | `.claude/skills/design-taste-frontend/` → `.agents/skills/` |
| image-to-code | `.claude/skills/image-to-code/` → `.agents/skills/` |
| redesign-existing-projects | `.claude/skills/redesign-existing-projects/` → `.agents/skills/` |
| full-output-enforcement | `.claude/skills/full-output-enforcement/` → `.agents/skills/` |

## Surface routing

| Surface | Primary depth | Never |
|---------|---------------|-------|
| `apps/web-vite` | impeccable + `PRODUCT.md` product register | design-taste on tables/wizards |
| `/portal` | impeccable (guided, lighter density) | design-taste |
| `packages/ui` | impeccable product tone | design-taste |
| `apps/landing` | design-taste (+ optional image-to-code) | skip frontend-design |

## Workflows (contractor-ops)

### Small web-vite fix (1–2 files)

1. frontend-design + semble
2. `cavecrew-builder` or main `Edit` after `Read`
3. impeccable `audit` if forms, focus, or RTL

### New product flow (wizard, tab, panel)

1. frontend-design + `[ui-strict]` (Claude Code hooks)
2. impeccable `shape` → hook + wired component per `apps/web-vite/ARCHITECTURE.md`
3. impeccable `craft` / `harden`
4. `cavecrew-reviewer` or impeccable `critique`

### Landing / marketing

1. frontend-design
2. design-taste (Design Read + dials)
3. Optional image-to-code (mock per section)
4. full-output when shipping full page
5. redesign-existing-projects only for **existing** landing uplift
6. impeccable `audit` before merge (optional)

### “AI slop” redesign

| Where | Path |
|-------|------|
| Existing landing | redesign → design-taste pre-flight → fix waves |
| Greenfield landing | design-taste → image-to-code → full-output |
| web-vite screen | impeccable `critique` → `quieter` / `layout` / `polish` |

## Hooks

- **`[ui]` / `[ui-strict]`** — enforce frontend-design + semble before UI edits (Claude Code)
- Guard paths: `apps/web-vite/`, `apps/landing/`, `packages/ui/` (`.claude/hooks/ui-workflow-lib.js`)
- Cursor: `.cursor/rules/30-ui-a11y.mdc` — verify tool log when `[ui]` prefixed

## Concurrent skills

Complementary layers load together (frontend-design + impeccable + full-output). **One primary depth** per screen: design-taste **or** impeccable product, not both on the same dashboard.

## Related

- [[patterns/agent-delegation]] — UI locate/fix/review subagents
- [[patterns/web-vite-data-layer]] — hook/container architecture
- [[structure/cms-and-landing]] — landing vs web-vite split
- `PRODUCT.md` § Design tooling

## Agent mistakes

- Using design-taste on contractor detail or invoice tables
- Skipping frontend-design on landing (“taste is enough”)
- Loading all six SKILL.md files every turn (token bloat)
- Assuming `apps/web/` — canonical SPA is `apps/web-vite`
