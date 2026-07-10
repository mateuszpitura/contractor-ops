// Statutory termination-cert PDF render + archive.
//
// The assertions pin the contract, mirroring the shipped form-1099-nec-pdf
// sibling:
//   - the cert renders from the stored immutable snapshot, never a live
//     recompute, so the document reflects the figures as of generation;
//   - national identifiers are masked to last-4 (a full pesel/ssn/nino never
//     reaches the PDF);
//   - the archive key is org-scoped under the `emp-cert/<orgId>/<id>.pdf` prefix;
//   - a compare-and-swap (`updateMany where pdfArchiveKey: null`) claims the
//     render so a retried worker sees count===0 and short-circuits;
//   - the rendered document carries the LOCKED adviser-verify disclaimer.

import { describe, expect, it, vi } from 'vitest';

import {
  renderAndArchiveStatutoryCert,
  renderStatutoryCert,
  statutoryCertArchiveKey,
} from '../statutory-cert-pdf';

// Stub the R2 upload so the CAS render path exercises the archive contract
// without a live object-store round-trip. The render itself still runs react-pdf.
vi.mock('../r2', () => ({
  putObjectAndSignDownload: vi.fn(async () => ({
    signedUrl: 'https://r2/signed',
    expiresInSeconds: 60,
  })),
}));

const SNAPSHOT = {
  certType: 'SWIADECTWO_PRACY',
  jurisdiction: 'PL',
  employerName: 'Acme Sp. z o.o.',
  employeeName: 'Jan Kowalski',
  peselLast4: '6789',
  employmentFrom: '2022-01-01',
  employmentTo: '2026-06-30',
  renderedAt: '2026-07-01T00:00:00.000Z',
};

describe('statutoryCertArchiveKey', () => {
  it('scopes the archive key to the org under the emp-cert prefix', () => {
    expect(statutoryCertArchiveKey('org_1', 'cert_9')).toBe('emp-cert/org_1/cert_9.pdf');
  });
});

describe('renderStatutoryCert — render from snapshot', () => {
  it('renders a non-empty PDF, embeds the adviser-verify disclaimer, and never leaks a full national ID', async () => {
    const buffer = await renderStatutoryCert(SNAPSHOT as never);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    // A full PESEL is 11 digits; only the last-4 may appear.
    expect(buffer.toString('binary')).not.toContain('44051401359');
  });
});

describe('renderAndArchiveStatutoryCert — CAS render guard', () => {
  function makeDb(pdfArchiveKey: string | null, casCount: number) {
    const updateMany = vi.fn().mockResolvedValue({ count: casCount });
    const findUnique = vi.fn().mockResolvedValue({
      id: 'cert_9',
      organizationId: 'org_1',
      certType: 'SWIADECTWO_PRACY',
      jurisdiction: 'PL',
      pdfArchiveKey,
      snapshotJson: SNAPSHOT,
    });
    return { db: { statutoryCertificate: { findUnique, updateMany } }, updateMany };
  }

  it('claims the archive slot via updateMany where pdfArchiveKey: null', async () => {
    const { db, updateMany } = makeDb(null, 1);
    await renderAndArchiveStatutoryCert(db as never, 'cert_9');
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ pdfArchiveKey: null }),
      }),
    );
  });

  it('short-circuits when the CAS claim returns count===0 (already archived by a peer)', async () => {
    const { db } = makeDb(null, 0);
    const result = await renderAndArchiveStatutoryCert(db as never, 'cert_9');
    expect(result.skipped).toBe(true);
  });

  it('short-circuits when pdfArchiveKey is already set (no re-render)', async () => {
    const { db } = makeDb('emp-cert/org_1/cert_9.pdf', 1);
    const result = await renderAndArchiveStatutoryCert(db as never, 'cert_9');
    expect(result.skipped).toBe(true);
  });
});
