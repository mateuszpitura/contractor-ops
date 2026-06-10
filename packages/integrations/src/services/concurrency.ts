// ---------------------------------------------------------------------------
// Concurrency helpers
// ---------------------------------------------------------------------------
//
// Thin re-export of `p-limit` so consumers in sibling workspace packages can
// use the same concurrency-cap primitive without taking a separate `p-limit`
// dependency. The integrations package already depends on p-limit (used by
// `resilience.ts` for per-provider bulkheads); routing all callers through
// this module keeps the dependency graph narrow and gives us one place to
// swap implementations if we ever do.
//
// Use when fanning out a Promise.all over network calls to a single upstream
// (e.g. dual-pushing a calendar invite to N connected providers, sending
// bulk Slack notifications). Pick the limit based on the upstream's rate
// budget — most providers are happy with 5–10 concurrent calls per process.

export type { LimitFunction } from 'p-limit';
export { default as pLimit } from 'p-limit';
