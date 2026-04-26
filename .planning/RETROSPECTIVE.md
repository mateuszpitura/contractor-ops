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

## Milestone: v2.0 — Platform Expansion

**Shipped:** 2026-04-01
**Phases:** 16 | **Plans:** 52 | **Tasks:** 103

### What Was Built
- Contractor self-service portal: magic-link auth, contract/invoice/document/payment views, invoice submission with OCR pre-fill, profile management with approval workflow, notification preferences, org branding with custom subdomain routing
- Integration framework: provider adapter pattern with AES-256-GCM credential store, unified webhook pipeline (QStash), OAuth callback with CSRF, proactive token refresh with distributed lock, health monitoring dashboard
- Electronic signatures: DocuSign (embedded iframe) + Autenti (redirect), multi-party signing with routing order, webhook-driven signed PDF archival, portal signing flow
- AI-powered invoice OCR: Claude Vision with native PDF support, per-field confidence scoring, side-by-side review panel, NIP checksum validation
- KSeF national e-invoicing: RSA-OAEP challenge auth, FA(3) XML parser, hourly QStash sync, cross-source duplicate detection
- Time tracking: weekly timesheet grid, Clockify API + Jira OAuth worklog import, manager approval queue, invoice deviation flagging
- Jira bidirectional sync: auto-issue creation from workflows, status mapping with loop prevention, webhook handler, linked issue chips
- Documentation integration: Notion/Confluence page linking in workflows, Cmd+K doc search
- Calendar integration: Google/Outlook deadline auto-push on contract/approval/invoice lifecycle, workflow task event creation
- 6 gap closure phases (21-27) fixing build errors, component mounting, adapter registration, auth wiring, OAuth callbacks

### What Worked
- **Provider adapter pattern** — single infrastructure for 10 integrations (Slack, Jira, DocuSign, Autenti, KSeF, Clockify, Notion, Confluence, Google Calendar, Outlook Calendar), zero per-provider infrastructure code
- **Gap closure phases** — milestone audit identified 7 cross-phase wiring issues; small focused phases (1 plan each) closed all gaps efficiently
- **Fire-and-forget pattern** — `void + .catch()` for calendar sync, Jira issue creation, OCR processing; never blocks user mutations
- **Portal as route group** — sharing auth, DB, tRPC, UI packages avoided duplication while keeping clean separation via `portalProcedure`
- **3-source requirement verification** — VERIFICATION.md + SUMMARY frontmatter + REQUIREMENTS.md traceability caught 2 stale "Pending" entries (INTG-01, OCR-03) that were actually satisfied

### What Was Inefficient
- **Gap closure phase count** — 7 phases (21-27) for wiring fixes that should have been caught during initial phase execution; integration checker at phase boundaries would have prevented most
- **dist/ stale on checkout** — multiple phases tripped over stale TypeScript build artifacts; added postinstall to fix but should have been addressed in Phase 12
- **Test stubs without implementation** — 200+ `it.todo()` stubs created across v2.0 but none implemented; provides behavior contracts but zero regression safety
- **Dead code accumulation** — orphaned tRPC procedures (`getOrgBranding`, `syncContractDeadline`, `syncPaymentDeadline`) shipped and only caught at milestone audit

### Patterns Established
- Per-provider encryption keys via `${SLUG_UPPER}_ENCRYPTION_KEY` env var convention
- BaseAdapter with optional OAuth/webhook/health capabilities
- `registerAllAdapters()` with idempotent guard at module scope for API routes
- QStash for async processing (webhooks, OCR, KSeF sync) with signature verification
- Portal magic-link auth with SHA-256 hashed sessions and httpOnly cookies
- `calendarTaskConfigSchema.safeParse(configJson)` pattern for reading structured task template config
- Dynamic CSS import via `useEffect` for Next.js-incompatible library styles (react-pdf)

### Key Lessons
1. **Run integration checker before gap closure, not after** — 5 of 7 gap closure phases addressed issues visible in a cross-phase wiring check
2. **Bank account encryption was missing** — storing plaintext in a field named "encrypted" is both misleading and a security gap; fixed with AES-256-GCM during milestone completion
3. **postinstall for TypeScript monorepos is mandatory** — `^build` dependency in turbo.json handles ordering but not initial checkout; postinstall closes the gap
4. **Dead code ships silently** — orphaned procedures were never caught until the integration checker listed tRPC endpoints with zero callers
5. **Portal session expiry needs explicit redirect** — relying on tRPC UNAUTHORIZED to fail queries leaves users on a blank page instead of login

### Cost Observations
- Model mix: ~65% Opus (execution, verification), ~35% Sonnet (research, checking, integration)
- 14 days from Phase 12 start to milestone complete
- Gap closure phases averaged <2 min execution each — high ROI for small fixes

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | Days | LOC | Key Pattern |
|-----------|--------|-------|------|-----|-------------|
| v1.0 MVP | 11 | 51 | 6 | 214K | Wave-based parallel execution |
| v2.0 Platform Expansion | 16 | 52 | 14 | +44K | Provider adapter pattern, gap closure phases |
