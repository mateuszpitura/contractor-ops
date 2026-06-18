// Zod schema for the flag-namespace signoff registry.
//
// Independent of the disclaimer signoff registry
// (`packages/validators/src/legal/signoff-registry-schema.ts`):
//   - Different approver-role enum (legal/compliance/privacy/external)
//   - Different gate timing (boot vs production-deploy)
//   - Different consumer (feature-flags registry-load vs ci-legal-gate-production)
//
// Consumed at boot by `packages/feature-flags/src/registry.ts` to refuse to
// start the app when a gated-namespace flag is missing a registry entry, or
// is APPROVED without a legalTicketRef.

import { z } from 'zod';

const flagSignoffEntryObjectSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED']),
  approvedBy: z.string().optional(),
  approvedAt: z.iso.datetime().optional(),
  approverRole: z
    .enum(['LEGAL_LEAD', 'COMPLIANCE_OFFICER', 'PRIVACY_COUNSEL', 'EXTERNAL_COUNSEL'])
    .optional(),
  approverEmailHash: z.string().optional(),
  legalTicketRef: z
    .string()
    .regex(/^(LEGAL-\d+|https?:\/\/.+)$/, {
      message: 'legalTicketRef must be a LEGAL-N ticket id or full URL',
    })
    .optional(),
  notes: z.string().optional(),
});

export const FlagSignoffEntrySchema = flagSignoffEntryObjectSchema.refine(
  entry => {
    if (entry.status !== 'APPROVED') return true;
    return !!(entry.approvedBy && entry.approvedAt && entry.approverRole && entry.legalTicketRef);
  },
  {
    message: 'APPROVED entries require approvedBy, approvedAt, approverRole, AND legalTicketRef',
  },
);

export type FlagSignoffEntry = z.infer<typeof FlagSignoffEntrySchema>;
export type FlagSignoffStatus = 'PENDING' | 'APPROVED';
export type FlagApproverRole = z.infer<typeof flagSignoffEntryObjectSchema.shape.approverRole>;

export const FlagSignoffRegistrySchema = z.record(z.string(), FlagSignoffEntrySchema);
export type FlagSignoffRegistry = z.infer<typeof FlagSignoffRegistrySchema>;
