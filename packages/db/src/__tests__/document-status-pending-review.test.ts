// Schema test for the PENDING_REVIEW document status.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SCHEMA = fs.readFileSync(
  path.resolve(__dirname, '../../prisma/schema/contract.prisma'),
  'utf8',
);

describe('document-status-pending-review', () => {
  it('DocumentStatus enum contains PENDING_REVIEW between ACTIVE and SUPERSEDED', () => {
    const block = SCHEMA.match(/enum DocumentStatus \{([\s\S]+?)\}/);
    expect(block, 'DocumentStatus enum not found').not.toBeNull();
    const values = ((block as RegExpMatchArray)[1] as string).match(/\b[A-Z_]+\b/g) ?? [];
    const idxActive = values.indexOf('ACTIVE');
    const idxPending = values.indexOf('PENDING_REVIEW');
    const idxSuperseded = values.indexOf('SUPERSEDED');
    expect(idxPending).toBeGreaterThan(idxActive);
    expect(idxPending).toBeLessThan(idxSuperseded);
  });
});
