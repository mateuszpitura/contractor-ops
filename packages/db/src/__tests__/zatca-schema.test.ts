import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCHEMA_DIR = resolve(import.meta.dirname, '../../prisma/schema');

function readSchema(name: string): string {
  return readFileSync(resolve(SCHEMA_DIR, name), 'utf8');
}

describe('ZATCA Prisma schema', () => {
  it('ZatcaInvoiceChain model has all required fields', () => {
    const zatca = readSchema('zatca.prisma');
    expect(zatca).toContain('model ZatcaInvoiceChain');
    expect(zatca).toContain('organizationId');
    expect(zatca).toContain('icv');
    expect(zatca).toContain('invoiceId');
    expect(zatca).toContain('invoiceHash');
    expect(zatca).toContain('previousHash');
    expect(zatca).toContain('zatcaUuid');
    expect(zatca).toContain('zatcaStatus');
    expect(zatca).toContain('zatcaResponse');
    expect(zatca).toContain('submittedAt');
    expect(zatca).toContain('clearedAt');
    expect(zatca).toContain('reportedAt');
    expect(zatca).toContain('rejectedAt');
    expect(zatca).toContain('rejectionReason');
  });

  it('has @@unique([organizationId, icv]) constraint', () => {
    const zatca = readSchema('zatca.prisma');
    expect(zatca).toContain('@@unique([organizationId, icv])');
  });

  it('ZATCA added to IntegrationProvider enum', () => {
    const integration = readSchema('integration.prisma');
    expect(integration).toContain('ZATCA');
  });

  it('ZatcaSubmissionStatus has all required values', () => {
    const zatca = readSchema('zatca.prisma');
    expect(zatca).toContain('enum ZatcaSubmissionStatus');
    expect(zatca).toContain('PENDING');
    expect(zatca).toContain('SUBMITTED');
    expect(zatca).toContain('CLEARED');
    expect(zatca).toContain('REPORTED');
    expect(zatca).toContain('REJECTED');
    expect(zatca).toContain('WARNING');
  });
});
