import { z } from 'zod';

/** Client-safe DTO for integration scope capabilities (no Prisma dependency). */
export const providerIdSchema = z.enum(['google', 'slack', 'entra', 'okta', 'github']);

export const capabilityEnumSchema = z.enum([
  'directory.read',
  'directory.write',
  'user.deprovision',
  'user.suspend',
  'group.read',
  'group.write',
  'audit.read',
]);

export const scopeCapabilitiesSchema = z.object({
  provider: providerIdSchema,
  scopes: z.array(z.string()),
  capabilities: z.array(capabilityEnumSchema),
  grantedAt: z.iso.datetime(),
});

export type ProviderId = z.infer<typeof providerIdSchema>;
export type CapabilityEnum = z.infer<typeof capabilityEnumSchema>;
export type ScopeCapabilities = z.infer<typeof scopeCapabilitiesSchema>;
