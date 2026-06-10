// ---------------------------------------------------------------------------
// ReassessmentTrigger.triggerReasons JSONB schema.
// ---------------------------------------------------------------------------
//
// Zod contract for the triggerReasons JSONB column on ReassessmentTrigger.
// MUST be used on both read and write paths — JSONB is untrusted input.
// Scan service reads existing reasons, appends a new entry, and re-parses
// before persisting.

import { z } from 'zod';

/**
 * A single material change recorded against a reassessment trigger.
 *
 * `resourceType` maps to the AuditLog EntityType that originated the reason
 * (CONTRACTOR = ContractorAssignment-level change, CONTRACT = Contract-level).
 * `auditLogId` is the primary key of the originating AuditLog row so the UI
 * can cite the source entry.
 */
export const triggerReasonSchema = z.object({
  field: z.string().min(1),
  oldValue: z.unknown().optional(),
  newValue: z.unknown().optional(),
  auditLogId: z.string().min(1),
  resourceType: z.enum(['CONTRACTOR', 'CONTRACT']),
  changedAt: z.coerce.date().optional(),
});

export type TriggerReason = z.infer<typeof triggerReasonSchema>;

export const triggerReasonsSchema = z.array(triggerReasonSchema);

export type TriggerReasons = z.infer<typeof triggerReasonsSchema>;
