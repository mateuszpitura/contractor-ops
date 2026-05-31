// Phase 76 D-01..D-12 types for IdP deprovisioning saga.
// Types only. Runtime implementations live in sibling files (cooldown.ts, run-status.ts,
// provenance.ts, gc.ts) and ship across Plans 76-04, 76-06, 76-10.

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
export type StepStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED';

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
