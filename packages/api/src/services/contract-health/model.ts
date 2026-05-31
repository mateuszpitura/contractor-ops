// Phase 75 D-04 — Typed-const model version pin for the contract health check.
// Bumping this requires the follow-up bulk-rerun-contract-health.ts admin script.
// Mirrors Phase 70 D-02 typed-constants philosophy + Phase 71 D-03 POLICY_RULE_SET_VERSION.
//
// Value matches the ClaudeOcrAdapter default at ship time
// (packages/integrations/src/adapters/claude-ocr-adapter.ts — 'claude-sonnet-4-6').

export const CONTRACT_HEALTH_MODEL_VER = 'claude-sonnet-4-6' as const;

export type ContractHealthModelVer = typeof CONTRACT_HEALTH_MODEL_VER;
