/**
 * Eight semantic status variants — the contract between the AtelierStatusPill
 * component and its callers.
 *
 * Domain-aware mapping lives in ./mapper.ts. CSS color tokens live in
 * @contractor-ops/ui/styles/status.css under --status-{variant}{,-bg,-fg}.
 *
 * Variants:
 *   success     completed, paid, approved, valid — the "good" terminal state
 *   warning     expiring, approaching SLA, partial — needs attention soon
 *   danger      failed, rejected, breached, expired — the "bad" terminal state
 *   info        under review, scheduled, neutral notice — awaiting input
 *   neutral     draft, archived, void, skipped — undefined / not-yet-actioned
 *   processing  running, sending, exporting — in-flight async work
 *   blocked     waiting on prerequisite, suspended — externally gated
 *   live        currently-active / streaming / real-time-on indicator
 */
export type AtelierStatusVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'processing'
  | 'blocked'
  | 'live';

/**
 * Compile-time assertion: a switch over a discriminated union has been
 * exhausted. Pass the `never`-typed default branch through this helper
 * to make TS error if a new enum value is added without updating the
 * switch.
 *
 * Used by every domain mapper in ./mapper.ts.
 */
export function assertExhaustive(value: never): never {
  throw new Error(`Unhandled status variant: ${String(value)}`);
}
