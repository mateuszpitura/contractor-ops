// TIME-EMP-01 shape contract: the employee statutory time model is a NEW model
// keyed on the Worker identity root (workerId), deliberately distinct from the
// contractor-coupled TimeEntry — it carries no contractorId/contractId and owns
// the statutory dimensions (overtime bands, night, weekend/holiday, on-call).
// Asserted against the schema DSL so the distinction cannot silently regress.

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SCHEMA_DIR = path.resolve(__dirname, '../../../../db/prisma/schema');
const EMPLOYEE_TIME = fs.readFileSync(path.join(SCHEMA_DIR, 'employee-time.prisma'), 'utf8');
const TIME_TRACKING = fs.readFileSync(path.join(SCHEMA_DIR, 'time-tracking.prisma'), 'utf8');

function modelBlock(schema: string, model: string): string {
  const match = schema.match(new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`));
  if (!match) throw new Error(`model ${model} not found`);
  return match[0];
}

describe('EmployeeTimeRecord shape', () => {
  const block = modelBlock(EMPLOYEE_TIME, 'EmployeeTimeRecord');

  it('keys on workerId, never on a contractor/contract FK', () => {
    expect(block).toMatch(/\bworkerId\s+String\b/);
    expect(block).not.toMatch(/\bcontractorId\b/);
    expect(block).not.toMatch(/\bcontractId\b/);
    expect(block).not.toMatch(/\btimesheetId\b/);
  });

  it('carries the statutory dimensions the ewidencja + payroll need', () => {
    expect(block).toMatch(/overtimeMinutes50/);
    expect(block).toMatch(/overtimeMinutes100/);
    expect(block).toMatch(/nightMinutes/);
    expect(block).toMatch(/weekendHolidayMinutes/);
    expect(block).toMatch(/onCallMinutes/);
    expect(block).toMatch(/wtOptOut/);
  });

  it('is day-grain unique per (organizationId, workerId, workDate)', () => {
    expect(block).toMatch(/@@unique\(\[organizationId, workerId, workDate\]\)/);
  });

  it('uses a distinct source enum (EmployeeTimeSource), never the taken TimeEntrySource', () => {
    expect(block).toMatch(/source\s+EmployeeTimeSource/);
    expect(EMPLOYEE_TIME).toMatch(/enum EmployeeTimeSource \{/);
  });

  it('does not collide with the contractor TimeEntry unique tuple', () => {
    const timeEntry = modelBlock(TIME_TRACKING, 'TimeEntry');
    expect(timeEntry).toMatch(/contractorId/);
    expect(timeEntry).not.toMatch(/@@unique\(\[organizationId, workerId, workDate\]\)/);
  });
});
