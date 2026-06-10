import { lookupCompanyByNip } from '@contractor-ops/integrations/services/company-registry-service';
import { companyLookupSchema, countryFieldsSchemaMap } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';

export const contractorCountryRouter = router({
  companyLookup: tenantProcedure
    .use(requirePermission({ contractor: ['create'] }))
    .input(companyLookupSchema)
    .query(async ({ input }) => {
      const result = await lookupCompanyByNip(input.nip);
      if (!result.found) {
        return { found: false as const, error: E.COMPANY_LOOKUP_FAILED };
      }
      return {
        found: true as const,
        legalName: result.legalName ?? '',
        regon: result.regon ?? '',
        addressLine1: result.addressLine1 ?? '',
        city: result.city ?? '',
        postalCode: result.postalCode ?? '',
      };
    }),

  getCountryFieldsConfig: tenantProcedure.query(async ({ ctx }) => {
    const org = await ctx.db.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { countryCode: true },
    });
    if (!(org.countryCode && countryFieldsSchemaMap[org.countryCode])) {
      return { hasCountryFields: false, countryCode: org.countryCode };
    }
    let fields: string[];
    if (org.countryCode === 'US') {
      fields = ['entityType', 'ein', 'addressLine1', 'city', 'state', 'zipCode'];
    } else if (org.countryCode === 'AE') {
      fields = ['freelancePermitNumber'];
    } else {
      fields = ['freelanceSaLicense', 'commercialRegistration', 'commercialRegistrationExpiry'];
    }
    return { hasCountryFields: true, countryCode: org.countryCode, fields };
  }),

  getCountryFields: tenantProcedure
    .input(z.object({ contractorId: z.string() }))
    .query(async ({ ctx, input }) => {
      const contractor = await ctx.db.contractor.findUnique({
        where: { id: input.contractorId, organizationId: ctx.organizationId },
        select: { countryFields: true },
      });
      if (!contractor) throw new TRPCError({ code: 'NOT_FOUND' });
      return contractor.countryFields ?? {};
    }),

  updateCountryFields: tenantProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(
      z.object({
        contractorId: z.string(),
        countryCode: z.string().length(2),
        fields: z.record(z.string(), z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUniqueOrThrow({
        where: { id: ctx.organizationId },
        select: { countryCode: true },
      });
      if (!org.countryCode) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: E.ORG_NO_COUNTRY });
      }
      const schema = countryFieldsSchemaMap[org.countryCode];
      if (!schema) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `No country-specific fields defined for ${org.countryCode}`,
        });
      }
      const parsed = schema.safeParse(input.fields);
      if (!parsed.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid country fields: ${parsed.error.message}`,
        });
      }
      return ctx.db.contractor.update({
        where: { id: input.contractorId, organizationId: ctx.organizationId },
        data: { countryFields: parsed.data as object },
        omit: { ssnEncrypted: true },
      });
    }),
});
