# Retrospective: Contractor Ops

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-23
**Phases:** 11 | **Plans:** 51 | **Tasks:** 98

### What Was Built
- Full B2B contractor lifecycle platform: org setup, RBAC, contractors, contracts, documents, workflows, invoices, approvals, notifications, payments, dashboard, reports, import, onboarding, search
- 214K LOC TypeScript across 698 files in a Turborepo monorepo
- 19 tRPC routers, 40+ Prisma models across 11 bounded contexts
- Full Polish + English i18n with locale-aware formatting
- Complete invoice-to-payment pipeline with audit trail
- Slack integration with inline approve/reject actions

### What Worked
- **Wave-based parallel execution** — spawning 2-3 executor agents per wave kept phases under 15 minutes each
- **Phase-per-feature granularity** — each phase delivered a coherent, testable capability
- **Pattern replication** — establishing patterns early (wizard-dialog, TanStack Table, tsvector search, settingsJson) made later phases faster
- **Discussion → Research → Plan → Execute → Verify pipeline** — caught issues before execution (e.g., UI-SPEC checker flagging CTA copy)
- **Gap closure workflow** — Phase 11 quickly fixed integration issues found by milestone audit

### What Was Inefficient
- **Progress table drift** — ROADMAP.md progress table fell out of sync with actual completion status across phases
- **Phase 01 verification snapshot** — stale VERIFICATION.md caused false positive in milestone audit (ORG-07 tenant isolation)
- **Nyquist compliance** — VALIDATION.md files created but never fully executed; test stubs created but not run

### Patterns Established
- Integer grosze for all monetary fields (no floating-point)
- Local wizard Zod schemas mirroring validators package (avoid cross-package deps)
- base-ui render prop pattern (not Radix asChild) for all trigger components
- settingsJson merge pattern for org-level configuration
- Fire-and-forget pattern for async operations (notifications, virus scanning)
- nuqs for URL-synced table state across all list pages
- `?action=new` URL param pattern for wizard deep-linking from search/onboarding

### Key Lessons
1. **Establish patterns in Phase 1, replicate in Phase 2+** — the wizard-dialog and TanStack Table patterns were copy-pasted 8+ times
2. **i18n per phase, not as a final phase** — each phase included its own translations, preventing a massive i18n cleanup phase
3. **Audit at milestone boundary catches integration gaps** — sidebar nav hrefs and onboarding CTAs were broken across 6 files, only caught by cross-phase integration check
4. **Wave 0 test stubs are cheap insurance** — 50+ test stubs defined behavior contracts that guided implementation
5. **Gap closure phases are fast** — Phase 11 (2 plans, 3 tasks) fixed all audit issues in one wave

### Cost Observations
- Model mix: ~70% Opus (execution), ~30% Sonnet (verification/checking)
- Total context used efficiently — orchestrator stayed at ~10-15%, fresh subagents for each plan
- 6 days from project init to milestone complete

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | Days | LOC | Key Pattern |
|-----------|--------|-------|------|-----|-------------|
| v1.0 MVP | 11 | 51 | 6 | 214K | Wave-based parallel execution |
