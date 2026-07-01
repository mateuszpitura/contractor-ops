import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paymentExportFormatEnum } from '@contractor-ops/validators';
import { describe, expect, it } from 'vitest';

// The Zod export-format enum must stay a strict subset of the Prisma
// PaymentExportFormat enum: it may only ever name formats the database — and the
// file-export factory — actually know. The Prisma enum is the source of truth.
//
// The generated Prisma enum object is read straight from the schema file rather
// than imported from @contractor-ops/db: that package instantiates a Prisma
// client at import time and is mocked in every api unit test, so its enum values
// are not reachable here. packages/db/prisma/schema/payment.prisma is therefore
// the canonical member list this parity gate compares against.
const PAYMENT_PRISMA_SCHEMA = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../db/prisma/schema/payment.prisma',
);

function readPrismaExportFormatMembers(): Set<string> {
  const schema = readFileSync(PAYMENT_PRISMA_SCHEMA, 'utf8');
  const block = schema.match(/enum PaymentExportFormat \{([\s\S]*?)\}/);
  if (!block?.[1]) {
    throw new Error('PaymentExportFormat enum not found in payment.prisma');
  }
  return new Set(
    block[1]
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('//')),
  );
}

describe('paymentExportFormatEnum <-> Prisma PaymentExportFormat parity', () => {
  const prismaMembers = readPrismaExportFormatMembers();

  it('every Zod option is a member of the Prisma PaymentExportFormat enum (strict subset)', () => {
    for (const option of paymentExportFormatEnum.options) {
      expect(prismaMembers.has(option)).toBe(true);
    }
  });

  it('includes ACH_NACHA and FEDWIRE so the US file formats are selectable through lockAndExport', () => {
    expect(paymentExportFormatEnum.options).toContain('ACH_NACHA');
    expect(paymentExportFormatEnum.options).toContain('FEDWIRE');
  });
});
