---
title: CMS and landing apps
type: structure
tags: [structure, cms, landing, marketing]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - apps/cms/
  - apps/landing/
updated: 2026-06-10
---

# CMS and landing (non-staff SPA)

## Purpose

Marketing and content surfaces separate from staff `web-vite` SPA. Agents working on contractor ops core rarely edit these — know boundaries to avoid wrong-app changes.

## Flow

```mermaid
flowchart LR
  cms[apps/cms Payload] --> posts[Authors Categories Posts]
  landing[apps/landing Next.js] --> blog[blog consumption]
  landing --> billing[@contractor-ops/billing pricing]
```

## Entry points

| App | Path | Role |
|-----|------|------|
| CMS | `apps/cms` | Payload port 3002 — blog authoring |
| Landing | `apps/landing` | Next.js 16 marketing + blog public |
| CMS storage | `@payloadcms/storage-s3` → R2 ([[integrations/neon-r2]]) |
| Pricing | `apps/landing` uses `@contractor-ops/billing` |

## UI / data boundaries

- **Not** container+hook tRPC pattern — different stacks (Payload, Next)
- Legal/marketing copy: coordinate with `packages/validators/src/legal/` — no ad-hoc jurisdiction text
- Staff product UI: always `apps/web-vite`

## Invariants

- Do not port web-vite data-layer rules to landing blindly
- Blog content consumed by landing — schema changes need both apps checked

## Related

- [[apps]]
- [[integrations/stripe-billing]]
- [[patterns/i18n-and-locales]] (landing may differ from web-vite i18n setup)

## Verify live

```bash
ls apps/cms/src apps/landing/src 2>/dev/null | head
pnpm --filter @contractor-ops/landing typecheck 2>/dev/null | tail -3
```

## Agent mistakes

- Adding staff tRPC hooks to landing pages
- Duplicating legal phrases in CMS rich text instead of validators registry
