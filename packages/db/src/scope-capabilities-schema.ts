// Zod schema for IntegrationConnection.scopeCapabilities JSONB.
// Used at every READ boundary that consumes the column to validate the shape
// before branching on capabilities.

import { z } from 'zod';

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

export type ScopeCapabilitiesParsed = z.infer<typeof scopeCapabilitiesSchema>;
