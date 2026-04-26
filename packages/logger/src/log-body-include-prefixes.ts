/**
 * Procedures (or per-field allow-list entries) approved to log request bodies
 * in plaintext. Every entry MUST be paired with a `// reason: <text>` comment
 * on the same or preceding line, and entries must NOT contain wildcard `*`.
 *
 * Format:
 *   - 'router.procedure'                 — full procedure body in plaintext
 *   - 'router.procedure:fieldA,fieldB'   — only the listed body fields exempt
 *
 * Phase 70 D-06 D-08. Empty initial state — every entry requires manual review.
 * The pnpm lint:logs guard reads this constant directly to decide whether a
 * body-log site is allowed.
 */
export const LOG_BODY_INCLUDE_PREFIXES: readonly string[] = [
  // (intentionally empty — adding an entry requires a `// reason: ...` comment
  //  per the lint:logs guard. Code review on this constant is the human gate.)
] as const;
