import { z } from 'zod';

// ---------------------------------------------------------------------------
// PayrollFeed — the canonical intermediate DTO every export profile maps FROM.
// ---------------------------------------------------------------------------
//
// The feed is a PII-masked, already-joined employee record assembled by the
// API feed-builder (Worker + EmployeeProfile + PersonnelFile). Profiles are
// pure over this DTO and never touch Prisma, so they stay golden-testable and
// PII masking lives in exactly one place.
//
// PII invariant: this DTO carries `nationalIdLast4` only. A full national
// identifier (PESEL / SSN / SV-Nr / NINO) is NEVER a field here. Where a
// statutory format legally requires the full value, the feed-builder reveals
// it upstream through the audited `employeePii:read` path and injects it into
// `countryFields` for that single target only.

export const PAYROLL_EMPLOYMENT_STATUSES = [
  'ACTIVE',
  'ON_LEAVE',
  'SUSPENDED',
  'TERMINATED',
] as const;

export type PayrollEmploymentStatus = (typeof PAYROLL_EMPLOYMENT_STATUSES)[number];

export const payrollFeedEmployeeSchema = z.object({
  workerId: z.string(),
  displayName: z.string(),
  email: z.string().nullable(),
  /** ISO 3166-1 alpha-2 (PL | DE | GB | US) */
  countryCode: z.string(),
  /** PersonnelFile.hireDate as an ISO date string */
  hireDate: z.string().nullable(),
  /** PersonnelFile.terminatedAt as an ISO date string (the off-boarding anchor) */
  terminatedAt: z.string().nullable(),
  employmentStatus: z.enum(PAYROLL_EMPLOYMENT_STATUSES).nullable(),
  /** EmployeeProfile.etat — Decimal(3,2) serialized as a string */
  etat: z.string().nullable(),
  /** Last-4 of the market national ID (pesel / ssn / svNummer / niNumber) — never the full value */
  nationalIdLast4: z.string().nullable(),
  /** Per-market non-PII payroll references (EmployeeProfile.countryFields) */
  countryFields: z.record(z.string(), z.unknown()),
});

export type PayrollFeedEmployee = z.infer<typeof payrollFeedEmployeeSchema>;

export const payrollFeedSchema = z.object({
  organizationId: z.string(),
  generatedAt: z.string(),
  /** ISO 3166-1 alpha-2 country the target adapter belongs to */
  targetCountry: z.string(),
  employees: z.array(payrollFeedEmployeeSchema),
});

export type PayrollFeed = z.infer<typeof payrollFeedSchema>;
