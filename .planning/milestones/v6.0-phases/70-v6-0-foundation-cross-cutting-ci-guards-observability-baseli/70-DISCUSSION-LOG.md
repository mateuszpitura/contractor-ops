# Phase 70: v6.0 Foundation — Cross-Cutting CI Guards & Observability Baseline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 70-v6-0-foundation-cross-cutting-ci-guards-observability-baseli
**Areas discussed:** Enforcement layer + allowlist, PII redaction migration, Sign-off registry, OAuth scope upgrade + audit logger

---

## Enforcement layer + allowlist

### Where should the guards run?
| Option | Description | Selected |
|--------|-------------|----------|
| CI-only (PR check) | Slowest local feedback | |
| Husky pre-commit only | Slows every commit | |
| Both CI + husky pre-commit | Slows commits + redundant | |
| CI + husky pre-push (not pre-commit) | Fast commits, blocking before push, plus PR gate | ✓ |

**User's choice:** CI + husky pre-push (not pre-commit)

### Where do allowlists/exemptions live?
| Option | Description | Selected |
|--------|-------------|----------|
| Typed TS constants per guard | Compile-time check, code-review gate | ✓ |
| Single root JSON config | Centralized but loose typing | |
| Per-guard YAML in .github/ | Workflow-adjacent but not type-checked | |

**User's choice:** Typed TS constants per guard

### How verbose should guard failure output be?
| Option | Description | Selected |
|--------|-------------|----------|
| Structured diff + remediation pointer | Names the offender, points to fix-up procedure | ✓ |
| Terse one-liner per violation | Cheap but light on guidance | |
| Rich markdown PR comment | Heavier infra, harder to grep in CI logs | |

**User's choice:** Structured diff + remediation pointer

### Script topology — one entrypoint or three?
| Option | Description | Selected |
|--------|-------------|----------|
| Three independent scripts | Each fails independently in CI | ✓ |
| One umbrella `pnpm guards:check` | Couples three concerns | |
| Per-package commands via turbo | Adds turbo coupling for a flat concern | |

**User's choice:** Three independent scripts (`pnpm lint:schema`, `pnpm lint:logs`, `pnpm i18n:parity`)

---

## PII redaction migration

### Where does the new redaction default get enforced — and what's the migration shape?
| Option | Description | Selected |
|--------|-------------|----------|
| Default-redact at logger factory; opt-in per router | Forces every touch-point to declare intent; default is safe | ✓ |
| Default-redact via Pino transport, no factory change | Less invasive but harder to type-check at PR time | |
| Per-router child logger with explicit body=true | Most explicit, biggest diff | |

**User's choice:** Default-redact at logger factory with typed `withBodyLogging(['contractor.*'])` opt-in wrapper

### Where does the LOG_BODY_INCLUDE_PREFIXES allowlist live?
| Option | Description | Selected |
|--------|-------------|----------|
| Typed TS constant in packages/logger | Matches Area 1 D-02; compile-time, reviewable | ✓ |
| Environment variable parsed at boot | Invisible to PR review | |
| JSON config file at repo root | Inconsistent with typed-constants pattern | |

**User's choice:** Typed TS constant in packages/logger

### How do we audit existing routers for leaks before the cutover?
| Option | Description | Selected |
|--------|-------------|----------|
| AST scan: grep + ts-morph script in CI guard #2 | Same guard reports current offenders; reuses existing dep | ✓ |
| Runtime sampling + Axiom dashboard query | Requires production-like load — incompatible with LOCAL-ONLY | |
| Manual sweep of all routers/services in this PR | Not a permanent guard | |

**User's choice:** AST scan in CI guard #2

### What's the rollback story if redaction strips a field ops genuinely needs?
| Option | Description | Selected |
|--------|-------------|----------|
| Per-field allow with PR-reviewed justification | Required reason comment; highest signal | ✓ |
| Whole-router opt-out via boolean flag | Reverts the safety property in one flip | |
| No rollback path; if you need a field, log it explicitly | Strictest, minor migration friction | |

**User's choice:** Per-field allow with PR-reviewed justification

---

## Sign-off registry (feature flag namespaces)

### Reuse the existing disclaimer signoff registry, or add a parallel one for flag namespaces?
| Option | Description | Selected |
|--------|-------------|----------|
| Parallel registry: signoff-registry-flags.ts | Independent approver-role enums and gate timing | ✓ |
| Extend existing schema with `subjectType` field | Couples disclaimer + flag gates | |
| Embed signoff inline on the flag definition | Tightest coupling, duplicates approval pattern | |

**User's choice:** Parallel registry at `packages/feature-flags/src/signoff-registry-flags.ts`

### What does "refuses to load at boot" mean concretely for an unregistered approved flag?
| Option | Description | Selected |
|--------|-------------|----------|
| Hard process exit with structured error to stderr | Same shape as Prisma migration drift errors | ✓ |
| Warn at boot, gate at flag-evaluator call site | Allows broken deploy through to runtime | |
| Treat orphan flags as `false` and emit audit log | Silent dark-feature risk | |

**User's choice:** Hard process exit with structured error

### Which namespaces require a signoff entry to APPROVE?
| Option | Description | Selected |
|--------|-------------|----------|
| compliance-* | F1 Compliance (Phases 71–73) | ✓ |
| idp-deprovisioning | F2 IdP (Phases 76–78) | ✓ |
| gulf-* | F3 Gulf (Phase 79) | ✓ |
| offboarding-ip-* | F4 Offboarding (Phases 74–75) | ✓ |

**User's choice:** All four namespaces

### How is the "referencing legal-sign-off ticket commit" linked from APPROVED entries?
| Option | Description | Selected |
|--------|-------------|----------|
| Required `legalTicketRef` field with format check | Greppable, auditable, survives squash-merge | ✓ |
| Require commit message of registry change to reference ticket | History-dependent; can be lost | |
| Free-form `notes`, no enforcement | Loses audit value | |

**User's choice:** Required `legalTicketRef` field with `LEGAL-\d+` or URL format

---

## OAuth scope upgrade + audit logger

### What's the shape of `IntegrationConnection.scopeCapabilities`?
| Option | Description | Selected |
|--------|-------------|----------|
| Tagged-union JSONB with provider + scopes + capabilities | Code branches on typed enum, raw scopes preserved | ✓ |
| Provider-agnostic capability set only | Loses raw OAuth scope strings | |
| Raw scopes only | Forces interpretation everywhere | |

**User's choice:** Tagged-union JSONB

### How does the backfill populate `scopeCapabilities` for existing v3.0 connections?
| Option | Description | Selected |
|--------|-------------|----------|
| Static map per provider in migration script | Reproducible, no live API calls during migration | ✓ |
| Lazy backfill on first auth refresh | Fails CI guard #5 backfill assertion | |
| Re-introspect every connection's scopes via provider API | Slow, network-dependent, rate-limit risk | |

**User's choice:** Static map per provider in migration script

### How is the IdP audit-logger child structurally separated from the default-redacted root logger?
| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated `getIdpAuditLogger()` factory with explicit allow-list | Symmetric with `withBodyLogging()`; typed at call site | ✓ |
| Inline child logger with manual config at each call site | Trivially drift-prone | |
| Separate Pino instance with no redaction at all | Bypasses global mask | |

**User's choice:** Dedicated factory with explicit allow-list constant

### What does an existing v3.0 GWS user see when scopes upgrade for IdP deprovisioning?
| Option | Description | Selected |
|--------|-------------|----------|
| Banner in Integrations page; user-initiated re-OAuth with `prompt=consent` | Existing read-only flow keeps working; no surprise interruptions | ✓ |
| Force re-OAuth on next admin login (hard redirect) | Interrupts unrelated workflow | |
| Silently preserve old scopes; new feature only for new orgs | Most v3.0 customers never gain feature | |

**User's choice:** Banner + user-initiated re-OAuth with `prompt=consent`

---

## Claude's Discretion
- Exact CI workflow file structure under `.github/workflows/`
- Husky pre-push hook exact bash boilerplate
- ts-morph traversal performance details for `lint:logs`
- Capability enum naming convention (`directory.read` vs `DirectoryRead`)
- Exact stderr error format for D-10 (match Prisma migration drift shape)

## Deferred Ideas
- Runtime PII redaction sampling + Axiom dashboard (revisit when not LOCAL-ONLY)
- Inline signoff metadata on flag definitions (revisit at v7.0 if parallel registry duplicates info)
- Force re-OAuth on next admin login (revisit if reconnect uptake too slow in F2)
- PR-comment-based guard output (revisit if structured diff is hard to read in CI logs)
