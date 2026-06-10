// Types for the IdP deprovisioning saga.
// Runtime implementations live in sibling files (cooldown.ts, run-status.ts,
// provenance.ts, gc.ts).

export const COOLDOWN_DAYS = 14 as const;
export const MAX_ATTEMPTS = 3 as const;

export type AssignmentStatus = 'ACTIVE' | 'ENDED' | 'PLANNED';

export interface CooldownDecision {
  allowed: boolean;
  earliestDate?: Date;
  reason?: string;
}

export interface CooldownInput {
  endedAt: Date | null;
  jurisdictionTz: string;
  status: AssignmentStatus;
  now?: Date;
}

export type RunStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'PARTIAL_FAILURE' | 'FAILED';
// MANUAL_COMPLETED mirrors the Prisma DeprovisioningStepStatus enum
// (recomputeRunStatus selects `status` straight off the regenerated client).
// deriveRunStatus treats it as SUCCEEDED-equivalent for COMPLETED/PARTIAL_FAILURE.
export type StepStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'MANUAL_COMPLETED';

export interface StepRow {
  status: StepStatus;
  attempts: number;
}

export type DeprovisioningProvider = 'GOOGLE_WORKSPACE' | 'SLACK' | 'ENTRA' | 'OKTA' | 'GITHUB';
export type ProvenanceActionKind = 'SUSPEND' | 'REVOKE_SESSION';

export interface ProvenanceLookupInput {
  organizationId: string;
  provider: DeprovisioningProvider;
  externalUserId: string;
  actionKind: ProvenanceActionKind;
}

export interface ProvenanceMatchResult {
  id: string;
}

export interface GcResult {
  deleted: number;
}
