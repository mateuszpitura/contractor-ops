import { z } from 'zod';

// ---------------------------------------------------------------------------
// Prisma enum mirrors (string unions — validators package has no Prisma dep)
// ---------------------------------------------------------------------------

export const absenceKindEnum = z.enum([
  'VACATION',
  'SICK',
  'PARENTAL',
  'BEREAVEMENT',
  'STUDY',
  'UNPAID',
  'OTHER_JUSTIFIED',
  'UNJUSTIFIED',
]);
export type AbsenceKind = z.infer<typeof absenceKindEnum>;

export const employeeTimeSourceEnum = z.enum(['MANUAL', 'IMPORTED']);
export type EmployeeTimeSource = z.infer<typeof employeeTimeSourceEnum>;

// The model is day-grain (one row per worker per calendar day), so no single
// minute bucket can exceed a 24h day. This is a sanity ceiling, not a statutory
// working-time limit — those are evaluated per-jurisdiction downstream.
const DAILY_MINUTES_CEILING = 24 * 60;

const dailyMinutes = z.number().int().min(0).max(DAILY_MINUTES_CEILING).default(0);

// ---------------------------------------------------------------------------
// Day-grain employee time record upsert
// ---------------------------------------------------------------------------

export const upsertEmployeeTimeRecordInput = z
  .object({
    workerId: z.string().min(1),
    workDate: z.string().date(),
    workedMinutes: dailyMinutes,
    nightMinutes: dailyMinutes,
    overtimeMinutes50: dailyMinutes,
    overtimeMinutes100: dailyMinutes,
    weekendHolidayMinutes: dailyMinutes,
    onCallMinutes: dailyMinutes,
    onCallLocation: z.string().trim().max(200).optional(),
    absenceKind: absenceKindEnum.optional(),
    wtOptOut: z.boolean().default(false),
    source: employeeTimeSourceEnum.default('MANUAL'),
  })
  .strict();
export type UpsertEmployeeTimeRecordInput = z.infer<typeof upsertEmployeeTimeRecordInput>;
