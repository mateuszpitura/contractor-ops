// Phase 64 · D-12 — Zod schema for the disclaimer signoff registry.
//
// The registry records the legal review status of every locked disclaimer
// constant. Production deployments are blocked by ci-legal-gate-production
// when any entry has status 'PENDING'.

import { z } from 'zod';

const ApproverRoleSchema = z.enum([
  'UK_TAX_ADVISER',
  'STEUERBERATER',
  'INTERNAL_COUNSEL',
  'INTERNAL_PRODUCT',
]);

const SignoffEntryBaseSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED']),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  approverRole: ApproverRoleSchema.optional(),
  approverEmailHash: z.string().optional(), // SHA-256 of lowercase email — reversible via internal mapping
  upstreamRef: z.string().optional(), // Link to signed PDF / legal email message-id
  notes: z.string().optional(),
});

export const SignoffEntrySchema = SignoffEntryBaseSchema.refine(
  entry => {
    if (entry.status === 'APPROVED') {
      return !!(entry.approvedBy && entry.approvedAt && entry.approverRole);
    }
    return true;
  },
  {
    message: 'APPROVED entries require approvedBy, approvedAt, and approverRole fields',
  },
);

export type SignoffEntry = z.infer<typeof SignoffEntrySchema>;
export type SignoffStatus = 'PENDING' | 'APPROVED';
export type ApproverRole = z.infer<typeof ApproverRoleSchema>;

export const SignoffRegistrySchema = z.record(z.string(), SignoffEntrySchema);
export type SignoffRegistry = z.infer<typeof SignoffRegistrySchema>;
