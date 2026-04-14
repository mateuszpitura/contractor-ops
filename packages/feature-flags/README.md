# @contractor-ops/feature-flags

Typed wrapper around self-hosted Unleash OSS for contractor-ops.

## Why it exists

- **Compile-time flag existence** — flag keys are a TypeScript literal union (`FlagKey`) derived from the code registry. Referencing a non-existent flag fails `tsc`.
- **Jurisdiction as a structural invariant** — flags declared `jurisdiction: 'EU'` or `'ME'` return `false` for the mismatched region BEFORE the Unleash call. A misclick in the Unleash UI cannot expose a Gulf-only integration to an EU org, and vice versa.
- **Ship-dark by default** — if a flag is not yet created in Unleash, the evaluator returns the code-declared `default` (typically `false`), so you can merge gating code before the toggle exists.
- **Graceful degradation** — if Unleash is unreachable or env vars are missing, all flags resolve to their code-declared defaults instead of throwing.

## What lives where

| In code (this package) | In Unleash (regional, two instances: `unleash-eu` + `unleash-me`) |
|---|---|
| Flag keys (`FlagKey` literal union) | Toggle state (on / off) |
| Defaults | Strategies (UserIDs, gradual rollout, etc.) |
| Jurisdiction constraints | Per-environment overrides (dev / staging / production) |
| Owner / category / description / sunset | Audit log |

## Adding a new flag

1. Declare the flag in `src/registry.ts` with `key`, `description`, `default`, `category`, `jurisdiction`, `owner`, and optional `sunset`.
2. Use it wherever you need it: `useFlag('my.new-flag')`, `requireFeatureFlag('my.new-flag')`, `<Feature flag="my.new-flag">…</Feature>`, or `NavItem.flag`.
3. Merge + deploy. The flag is `false` for everyone (unless `default: true`) because the toggle does not yet exist in Unleash.
4. Create the toggle in **both** regional Unleash UIs (unless the flag has a jurisdiction constraint, in which case only the matching region). Set strategies as needed.
5. To retire: set `sunset` to a date, remove call sites once the feature has GA'd, then delete the registry entry and the Unleash toggle.

## What NOT to use this for

- **Domain configuration.** `Organization.isKleinunternehmer` changes tax behavior; it's not a release toggle. Leave that as a Prisma column.
- **Per-user preferences.** Use user settings, not flags.
- **Permission / RBAC gating.** Use `requirePermission` from `@contractor-ops/api`.

## Operational notes

- The SDK polls its regional Unleash every 15 seconds. Expect up to 15 s of flag-flip lag per Node instance.
- If you create a flag only in `unleash-eu` and it has `jurisdiction: 'ANY'`, ME orgs will fall to the code-declared default until you also create it in `unleash-me`. Mirror both regions for non-jurisdiction-scoped flags.
- Env vars (`UNLEASH_URL_EU`, `UNLEASH_API_TOKEN_EU`, `UNLEASH_URL_ME`, `UNLEASH_API_TOKEN_ME`) are optional in development — the package falls back to stub clients and code defaults. Required in production for real flag evaluation.
