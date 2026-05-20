# Seed coverage audit — Step 1 output

Generated from inspection of `packages/db/scripts/seed-dev.ts` (lines 803–931) and
the route inventories of `apps/web`, `apps/landing`, `apps/cms`.

## Profiles in `seed-dev.ts`

| Profile | Orgs | Users/Org | Contractors/Org | Invoices/Contractor | Notes |
| --- | --- | --- | --- | --- | --- |
| `empty` | 1 | 1 | 0 | 0 | Empty-state target |
| `solo` | 1 | 1 | 2 | 1–3 | Smallest non-empty |
| `small` (default) | 3 | 4 | 10 | 2–6 | — |
| `medium` | 5 | 10 | 100 | 3–8 | — |
| `huge` | 6 mixed | 30 | 1000 | 5–12 | Stress target |
| `showcase` | 1 | 8 | 40 | 4–7 | Every state populated |
| `all` | 8 mixed | mix | mix | mix | Union |

Seeded user roles per org (`pickMemberRole`, lines 1501–1521): `owner`,
`admin`, `team_manager`, `finance_admin`, plus weighted picks from
`ops_manager`, `legal_compliance_viewer`, `it_admin`, `external_accountant`,
`readonly`. Seed-user emails are generated (`first.last.<orgKey>@seed.local`)
and share password `Test1234!` (override via `SEED_PASSWORD`).

## Required orgs (per `facts.md`)

| Required org | State | Closest profile | Gap? |
| --- | --- | --- | --- |
| `qa-default-org` | Every entity in every status | `showcase` template (1 org) | Org key must be deterministic |
| `qa-empty-org` | Zero contractors / invoices / payments / equipment | `empty` template | Org key must be deterministic |
| `qa-stress-org` | 300+ contractors, 1000+ invoices, 200+ payment-runs | `huge` template (1000 contractors) | Payment-runs/org currently 20; bump to 200+ for stress |

**Conclusion:** introduce a new `qa` profile (or extend `showcase` to push three
orgs) that emits the three named orgs with deterministic keys. Reuse existing
volume templates; only `huge.paymentRunsPerOrg` needs a stress-org override
(20 → 200+).

## Required fixture users (per `facts.md`)

| Env key | Role on `qa-default-org` | Auth surface |
| --- | --- | --- |
| `QA_ADMIN_EMAIL` / `QA_ADMIN_PASSWORD` | `admin` (full dashboard) | Better Auth credential |
| `QA_ACCOUNTANT_EMAIL` / `QA_ACCOUNTANT_PASSWORD` | `external_accountant` (read-only on payments) | Better Auth credential |
| `QA_CONTRACTOR_EMAIL` / `QA_CONTRACTOR_PASSWORD` | Contractor entity → portal login | Portal magic token issued at seed time, or password-equivalent flow |

**Gap:** seeded users currently have generated emails. The `qa` profile must
insert three known-credential users (deterministic email + password env vars)
on top of the org. Portal contractor needs a long-lived `PortalMagicToken`
(or new portal-credential row) written so the walk can deep-link the portal
login.

## States covered per view — reachability matrix

Legend: ✔ = reachable from one of the three QA orgs; ✘ = not seed-driven;
🛠 = runtime-injected (Playwright route interception in the walk harness).

| State | qa-default-org | qa-empty-org | qa-stress-org | Source |
| --- | --- | --- | --- | --- |
| Default / loaded | ✔ | — | ✔ | `showcase` / `huge` |
| Empty (tab / org) | ✔ (some tabs) | ✔ | — | `empty` profile |
| Loading | 🛠 | 🛠 | 🛠 | Playwright `route.fulfill({ delay })` |
| Error (5xx) | 🛠 | 🛠 | 🛠 | Playwright `route.fulfill({ status: 500 })` |
| Disabled / read-only | ✔ | — | — | `external_accountant`, `readonly` roles seeded |
| Mobile (375) | 🛠 | 🛠 | 🛠 | Playwright viewport |
| RTL (`ar`) | ✔ | ✔ | ✔ | Locale switch (org region irrelevant for client UI) |
| Focus-visible | 🛠 | 🛠 | 🛠 | Walk harness tab-cycle |
| Dark theme | 🛠 | 🛠 | 🛠 | Walk harness theme toggle |
| Pagination / virtualization | — | — | ✔ | `huge` profile |

## Route × required state × profile

### `apps/web` — dashboard (admin role)

| Route | Required state | qa-default-org | qa-empty-org | qa-stress-org |
| --- | --- | --- | --- | --- |
| `/` (dashboard home) | default + empty | ✔ | ✔ | ✔ |
| `/contractors` + `/contractors/[id]` (+ engagements, classification subviews) | default + empty + pagination | ✔ | ✔ | ✔ (stress) |
| `/contracts` + `/contracts/[id]` | default + empty | ✔ | ✔ | ✔ |
| `/invoices` + `/invoices/[id]` + `/invoices/intake[/[id]]` | mixed lifecycle states (RECEIVED→PAID, REJECTED/VOID) | ✔ | ✔ | ✔ (stress) |
| `/payments` | payment runs + items | ✔ | ✔ | ✔ (stress, 200+ runs) |
| `/approvals` | active approval chains | ✔ | ✔ | ✔ |
| `/classification` + `/classification/expert-help` | classification assessments + SDS approvals | ✔ | ✔ | — |
| `/workflows` + `/workflows/[id]` + `/workflows/templates/[new\|[id]]` | templates + runs + comments | ✔ | ✔ | — |
| `/equipment` + `/equipment/[id]` | assignments + shipments + return requests | ✔ | ✔ | — |
| `/time` + `/time/[contractorId]` | time entries | ✔ | ✔ | — |
| `/reports` | data-driven charts | ✔ | ✔ | ✔ |
| `/notifications` | notifications per user | ✔ | ✔ | — |
| `/organization[/projects\|teams\|cost-centers]` | org structure | ✔ | ✔ | — |
| `/settings[/payments\|calendar\|workflow-roles\|e-invoicing[/log]\|tax\|members\|integrations/zatca]` | settings rows | ✔ | ✔ | — |
| `/onboarding/import` | empty + first-run | ✔ | ✔ | — |
| `/unauthorized` | static | ✔ | ✔ | ✔ |

### `apps/web` — auth (no role)

| Route | Required state | Source |
| --- | --- | --- |
| `/login` | unauth surface | static |
| `/register` | unauth surface | static |
| `/verify-email` | post-register surface | requires a verification token; walk hits the empty/error states only |
| `/invite/[token]` | invited surface | requires a live invite token; walk hits the empty/error states only |

### `apps/web` — portal (contractor role)

All portal routes require `QA_CONTRACTOR_EMAIL` to be logged in via portal
magic-token flow against a contractor entity in `qa-default-org`. Empty-state
parity comes from a second contractor in `qa-empty-org` with zero attachments.

| Route | qa-default-org | qa-empty-org |
| --- | --- | --- |
| `/portal` | ✔ | ✔ |
| `/portal/login`, `/portal/login/verify` | static | static |
| `/portal/contracts[/[id]]` | ✔ | ✔ |
| `/portal/invoices[/[id]\|/submit\|/submit/success]` | ✔ | ✔ |
| `/portal/payments` | ✔ | ✔ |
| `/portal/documents` | ✔ | ✔ |
| `/portal/equipment` | ✔ | ✔ |
| `/portal/time` | ✔ | ✔ |
| `/portal/settings` | ✔ | ✔ |

### `apps/web` — legal

Static MDX/HTML — no DB dependency.

| Route | Source |
| --- | --- |
| `/legal/privacy[/[jurisdiction]]`, `/legal/terms`, `/legal/sub-processors`, `/legal/breach-notification` | Static — walk for layout / locale / RTL only |

### `apps/landing` (anonymous)

All landing routes are statically exported. Blog routes require Payload data
(see `seed-qa.ts`).

| Route | Required state | Source |
| --- | --- | --- |
| `/` | static | — |
| `/about`, `/security`, `/pricing`, `/changelog` | static | — |
| `/solutions/[role]` | static (role param iterates) | — |
| `/compare/[competitor]` | static (competitor param iterates) | — |
| `/blog`, `/blog/[slug]`, `/blog/author/[handle]`, `/blog/tag/[tag]` | published posts × 4 locales, 2 authors, 3 tags, 2 categories | `apps/cms/scripts/seed-qa.ts` (new) |

### `apps/cms` (admin role)

| Route | Required state | Source |
| --- | --- | --- |
| `/admin` (login) | unauth surface | static |
| `/admin/collections/users` | seed-admin user + new seed-qa author users | existing `seed-admin.ts` + `seed-qa.ts` |
| `/admin/collections/posts` | 5 posts × 4 locales | `seed-qa.ts` |
| `/admin/collections/categories` | 2 categories | `seed-qa.ts` |
| `/admin/collections/tags` | 3 tags | `seed-qa.ts` |
| `/admin/collections/authors` | 2 authors | `seed-qa.ts` |
| `/admin/collections/media` | 8 assets | `seed-qa.ts` |
| `/admin/collections/legal-documents` | 4 docs (privacy/terms × 2 jurisdictions) | `seed-qa.ts` |
| Per-collection detail (`/admin/collections/<slug>/<id>`) | populated row from above | derived |
| Frontend preview routes (`/` and `[locale]` under `(frontend)`) | a published Post + 4 locale variants | `seed-qa.ts` |

## Gaps to close in Step 2 / Step 3 / Step 4

1. **New `qa` profile in `seed-dev.ts`** that pushes three orgs with the exact
   keys `qa-default-org` (`showcase` template), `qa-empty-org` (`empty`
   template), `qa-stress-org` (`huge` template, `paymentRunsPerOrg` bumped to
   200). Region pinned to EU so currency / language defaults are deterministic.
2. **Deterministic fixture users on `qa-default-org`** with env-controlled
   credentials (`QA_ADMIN_EMAIL/PASSWORD`, `QA_ACCOUNTANT_EMAIL/PASSWORD`)
   layered on top of the volume-driven user pool. Admin → `admin` member,
   accountant → `external_accountant` member.
3. **Portal contractor fixture** on `qa-default-org` — contractor entity with
   a known contact email (`QA_CONTRACTOR_EMAIL`), and a long-lived
   `PortalMagicToken` (or password) written so the walk can authenticate.
4. **`apps/cms/scripts/seed-qa.ts`** — Payload local-API seeder for 5
   Posts × 4 locales, 2 Authors, 2 Categories, 3 Tags, 4 LegalDocuments, 8
   Media. Idempotent (mirror the `seed-admin.ts` pattern).
5. **Repo-level `pnpm seed:qa`** that fans out to (a) `seed-dev --profile=qa
   --confirm --regions=EU --seed=qa-walk` and (b) `apps/cms/scripts/seed-qa.ts`.
6. **`.env.example` keys** for the six `QA_*` variables (empty values only;
   real values land in `.env` at seed time).

States that remain runtime-only (`🛠` above) require no seed work — they are
implemented entirely inside the walk orchestrator (Step 6) via Playwright
route interception, viewport overrides, theme toggling, and tab-cycling.

## Verification (Step 1)

Every state in `facts.md` §"States covered per view" is either reachable from
one of the three QA orgs once the gaps above land, or is runtime-only and
handled by the orchestrator. No state is unreachable; no profile is missing.
