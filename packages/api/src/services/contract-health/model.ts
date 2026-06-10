// Typed-const model version pin for the contract health check.
// Bumping this requires the follow-up bulk-rerun-contract-health.ts admin script.
//
// Value matches the ClaudeOcrAdapter default at ship time
// (packages/integrations/src/adapters/claude-ocr-adapter.ts — 'claude-sonnet-4-6').

export const CONTRACT_HEALTH_MODEL_VER = 'claude-sonnet-4-6' as const;

export type ContractHealthModelVer = typeof CONTRACT_HEALTH_MODEL_VER;
