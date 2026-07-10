import type { Prisma } from '@contractor-ops/db';
import {
  classifySaudiId,
  isValidEmiratesId,
  isValidPesel,
  isValidSsn,
  LOHNSTEUERKLASSE,
  NFZ_ODDZIAL_SOURCE,
  NFZ_ODDZIAL_VERSION,
  NFZ_ODDZIALY,
  SAUDIZATION_CATEGORY,
  STUDENT_LOAN_PLAN,
  saudizationCategorySchema,
  US_WITHHOLDING_STATES,
  validateEmployeeCountryFields,
  W4_FILING_STATUS,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { assertWorkforceEnabled } from '../../middleware/require-workforce-flag';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { decryptPii, encryptPii, maskLast4 } from '../../services/employee-pii-crypto';
import { onboardWorkerLeaveAccrual } from '../../services/leave-accrual';
import { decryptSsn, encryptSsn, maskSsnLast4 } from '../../services/ssn-crypto';

// ---------------------------------------------------------------------------
// Employee registry write + reveal surface. Composed into the workforce
// `employeeRouter` (staff appRouter only — never the portal), so it inherits
// the `module.workforce-employees` conditional-spread; each procedure also
// re-asserts the flag per request.
//
// Storage shape (1:1 EmployeeProfile sidecar on the Worker identity root):
//   - Non-PII per-market fields → validated wholesale by the per-market
//     `employeeCountryFieldsSchemaMap` and stored in the `countryFields` JSON.
//   - National-person identifiers (PESEL/SSN/Iqama/Emirates ID) → encrypted at
//     rest in dedicated columns, NEVER in the JSON, and OMITTED from every
//     response. The plaintext is reachable only via the audit-logged,
//     `employeePii:read`-gated `revealPii` path.
//   - The three dashboard-filterable attributes (saudizationCategory / etat /
//     employmentStatus) are promoted to typed columns via dedicated typed
//     inputs, decoupled from the loosely-typed JSON for indexing.
//
// The Emirates-ID checksum is advisory only: a format-valid ID whose Luhn
// variant fails still registers and surfaces a soft `checksumAdvisory`; it
// never blocks the write.
// ---------------------------------------------------------------------------

const REGISTRY_COUNTRY_CODES = ['PL', 'DE', 'GB', 'US', 'AE', 'SA'] as const;

const employmentStatusSchema = z.enum(['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED']);

// Contract-type axis (distinct from the employmentStatus lifecycle axis) the HR
// headcount breakdown groups by.
const employmentTypeSchema = z.enum([
  'FULL_TIME',
  'PART_TIME',
  'FIXED_TERM',
  'TEMPORARY',
  'APPRENTICE',
  'SEASONAL',
]);

// Decimal(3,2) part-time fraction (0.10–1.00) kept as a string to avoid float
// drift before it reaches the typed column.
const etatSchema = z
  .string()
  .refine(
    v => /^(?:0\.(?:[1-9]\d?|\d[1-9])|1(?:\.00?)?)$/.test(v),
    'etat must be between 0.10 and 1.00',
  );

const registerInputSchema = z
  .object({
    displayName: z.string().trim().min(1),
    email: z.string().email().optional(),
    countryCode: z.enum(REGISTRY_COUNTRY_CODES),
    // Non-PII per-market fields. Validated wholesale by the per-market schema,
    // whose own `.strict()` rejects any national-ID key smuggled into the JSON.
    countryFields: z.record(z.string(), z.unknown()).optional(),
    // National-ID plaintexts — separate keys, never inside `countryFields`.
    pesel: z.string().optional(),
    ssn: z.string().optional(),
    iqama: z.string().optional(),
    emiratesId: z.string().optional(),
    // Promoted typed columns (dashboard-indexable).
    employmentStatus: employmentStatusSchema.optional(),
    saudizationCategory: saudizationCategorySchema.optional(),
    etat: etatSchema.optional(),
    // HR-dashboard capture columns — read-only aggregations groupBy/window over
    // these; the registry write is the only path that populates them.
    department: z.string().trim().min(1).max(120).optional(),
    employmentType: employmentTypeSchema.optional(),
    contractEndDate: z.coerce.date().optional(),
    probationEndsAt: z.coerce.date().optional(),
    /** Optional retroactive hire date; defaults to registration day (UTC). */
    hireDate: z.coerce.date().optional(),
  })
  .strict();

const revealFieldSchema = z.enum(['ssn', 'pesel', 'iqama', 'emiratesId']);

export const employeeRegistryRouter = router({
  register: tenantProcedure
    .use(requirePermission({ employee: ['create'] }))
    .input(registerInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);

      // Validate the non-PII per-market fields (throws ZodError → BAD_REQUEST).
      const countryFields = validateEmployeeCountryFields(
        input.countryCode,
        input.countryFields ?? {},
      );

      // Hard-block on a structurally invalid statutory national ID before any
      // encryption runs. Emirates ID is the sole exception below.
      if (input.pesel && !isValidPesel(input.pesel)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: E.EMPLOYEE_INVALID_PESEL });
      }
      if (input.ssn && !isValidSsn(input.ssn)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: E.EMPLOYEE_INVALID_SSN });
      }
      if (input.iqama && classifySaudiId(input.iqama) === false) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: E.EMPLOYEE_INVALID_IQAMA });
      }

      // Emirates ID: format is blocking, checksum is advisory-only — a
      // format-valid ID with a failing Luhn registers with a soft warning.
      let checksumAdvisory: string | undefined;
      if (input.emiratesId) {
        const result = isValidEmiratesId(input.emiratesId);
        if (!result.formatValid) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: E.EMPLOYEE_INVALID_EMIRATES_ID });
        }
        if (!result.checksumValid) {
          checksumAdvisory = E.EMPLOYEE_EMIRATES_ID_CHECKSUM_ADVISORY;
        }
      }

      const profileData: Omit<Prisma.EmployeeProfileUncheckedCreateInput, 'workerId'> = {
        organizationId: ctx.organizationId,
        countryCode: input.countryCode,
        countryFields: countryFields as Prisma.InputJsonValue,
        employmentStatus: input.employmentStatus,
        saudizationCategory: input.saudizationCategory,
        etat: input.etat,
        department: input.department,
        employmentType: input.employmentType,
        contractEndDate: input.contractEndDate,
        probationEndsAt: input.probationEndsAt,
      };

      if (input.pesel) {
        const cleaned = input.pesel.replace(/[\s-]/g, '');
        profileData.peselEncrypted = encryptPii(cleaned);
        profileData.peselLast4 = maskLast4(cleaned);
      }
      if (input.ssn) {
        const cleaned = input.ssn.replace(/[\s-]/g, '');
        profileData.ssnEncrypted = encryptSsn(cleaned);
        profileData.ssnLast4 = maskSsnLast4(cleaned);
      }
      if (input.iqama) {
        const cleaned = input.iqama.replace(/[\s-]/g, '');
        profileData.iqamaEncrypted = encryptPii(cleaned);
        profileData.iqamaLast4 = maskLast4(cleaned);
      }
      if (input.emiratesId) {
        profileData.emiratesIdEncrypted = encryptPii(input.emiratesId);
        profileData.emiratesIdLast4 = maskLast4(input.emiratesId);
      }

      const profile = await ctx.db.$transaction(async tx => {
        const worker = await tx.worker.create({
          data: {
            organizationId: ctx.organizationId,
            workerType: 'EMPLOYEE',
            displayName: input.displayName,
            email: input.email ?? null,
          },
          select: { id: true },
        });

        const hireDate =
          input.hireDate ??
          new Date(
            Date.UTC(
              new Date().getUTCFullYear(),
              new Date().getUTCMonth(),
              new Date().getUTCDate(),
            ),
          );

        const created = await tx.employeeProfile.create({
          data: { ...profileData, workerId: worker.id },
          omit: {
            peselEncrypted: true,
            ssnEncrypted: true,
            iqamaEncrypted: true,
            emiratesIdEncrypted: true,
          },
        });

        await tx.personnelFile.create({
          data: {
            organizationId: ctx.organizationId,
            workerId: worker.id,
            countryCode: input.countryCode,
            hireDate,
          },
        });

        await onboardWorkerLeaveAccrual(tx as import('../../services/approval-engine').TxClient, {
          organizationId: ctx.organizationId,
          workerId: worker.id,
          countryCode: input.countryCode,
          hireDate,
        });

        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: 'employee.registered',
          resourceType: 'EMPLOYEE',
          resourceId: worker.id,
          metadata: { employeeProfileId: created.id, countryCode: input.countryCode },
          tx,
        });

        return created;
      });

      return checksumAdvisory ? { ...profile, checksumAdvisory } : profile;
    }),

  revealPii: tenantProcedure
    .use(requirePermission({ employeePii: ['read'] }))
    .input(z.object({ workerId: z.string().min(1), field: revealFieldSchema }).strict())
    .mutation(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);

      // Select only the one requested encrypted column. Static per-field selects
      // keep the return strongly typed (a computed-key select collapses the
      // extended-client type inference).
      const where = { workerId: input.workerId, organizationId: ctx.organizationId };
      let record: { id: string; encrypted: string | null } | null = null;
      switch (input.field) {
        case 'ssn': {
          const row = await ctx.db.employeeProfile.findUnique({
            where,
            select: { id: true, ssnEncrypted: true },
          });
          record = row ? { id: row.id, encrypted: row.ssnEncrypted } : null;
          break;
        }
        case 'pesel': {
          const row = await ctx.db.employeeProfile.findUnique({
            where,
            select: { id: true, peselEncrypted: true },
          });
          record = row ? { id: row.id, encrypted: row.peselEncrypted } : null;
          break;
        }
        case 'iqama': {
          const row = await ctx.db.employeeProfile.findUnique({
            where,
            select: { id: true, iqamaEncrypted: true },
          });
          record = row ? { id: row.id, encrypted: row.iqamaEncrypted } : null;
          break;
        }
        case 'emiratesId': {
          const row = await ctx.db.employeeProfile.findUnique({
            where,
            select: { id: true, emiratesIdEncrypted: true },
          });
          record = row ? { id: row.id, encrypted: row.emiratesIdEncrypted } : null;
          break;
        }
      }

      if (!record?.encrypted) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const value =
        input.field === 'ssn' ? decryptSsn(record.encrypted) : decryptPii(record.encrypted);

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: `employee.${input.field}.revealed`,
        resourceType: 'EMPLOYEE',
        resourceId: input.workerId,
        metadata: { field: input.field, employeeProfileId: record.id },
      });

      return { field: input.field, value };
    }),

  listReferenceLists: tenantProcedure
    .use(requirePermission({ employee: ['read'] }))
    .query(({ ctx }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);

      // Non-PII, org-independent reference data backing the per-market
      // registration forms. Served from the static seed tuples.
      return {
        nfzOddzialy: NFZ_ODDZIALY,
        nfzOddzialVersion: NFZ_ODDZIAL_VERSION,
        nfzOddzialSource: NFZ_ODDZIAL_SOURCE,
        lohnsteuerklasse: LOHNSTEUERKLASSE,
        studentLoanPlan: STUDENT_LOAN_PLAN,
        w4FilingStatus: W4_FILING_STATUS,
        usWithholdingStates: US_WITHHOLDING_STATES,
        saudizationCategory: SAUDIZATION_CATEGORY,
      };
    }),
});
