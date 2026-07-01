// Form 1042-S recipient-copy PDF render + archive — Wave-0 RED scaffold.
//
// `form-1042s-pdf` does not exist yet, so importing it fails at resolution and
// this suite is terminal-RED until the render/archive service lands. The
// assertions pin the contract, mirroring the shipped form-1099-nec-pdf sibling:
//   - the recipient copy renders from the stored immutable snapshot, never a live
//     recompute, so the document reflects the figures as filed;
//   - the FTIN is masked to last-4 (a full foreign TIN never reaches the PDF);
//   - the archive key is org-scoped under the `1042-s/<orgId>/<id>.pdf` prefix;
//   - a compare-and-swap (`updateMany where pdfArchiveKey: null`) claims the
//     render so a retried worker sees count===0 and short-circuits.

import { describe, expect, it, vi } from 'vitest';

import {
  form1042sArchiveKey,
  renderAndArchiveRecipientCopy,
  renderForm1042SRecipientCopy,
} from '../form-1042s-pdf';

const SNAPSHOT = {
  taxYear: 2026,
  payerName: 'Acme Org',
  recipientName: 'Jean Contractor',
  recipientFtinLast4: '4821',
  box1IncomeCode: '17',
  box2GrossIncomeMinor: 500_000,
  box7FederalTaxWithheldMinor: 75_000,
  currency: 'USD',
};

describe('form1042sArchiveKey', () => {
  it('scopes the archive key to the org under the 1042-s prefix', () => {
    expect(form1042sArchiveKey('org_1', 'form_9')).toBe('1042-s/org_1/form_9.pdf');
  });
});

describe('renderForm1042SRecipientCopy — render from snapshot', () => {
  it('renders a non-empty PDF and never leaks a full FTIN', async () => {
    const buffer = await renderForm1042SRecipientCopy(SNAPSHOT as never);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.toString('binary')).not.toContain('999004821');
  });
});

describe('renderAndArchiveRecipientCopy — CAS render guard', () => {
  it('claims the archive slot via updateMany where pdfArchiveKey: null', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUnique = vi.fn().mockResolvedValue({
      id: 'form_9',
      organizationId: 'org_1',
      pdfArchiveKey: null,
      snapshotJson: SNAPSHOT,
    });
    const db = { form1042S: { findUnique, updateMany } };

    await renderAndArchiveRecipientCopy(db as never, 'form_9');

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ pdfArchiveKey: null }),
      }),
    );
  });

  it('short-circuits when the CAS claim returns count===0 (already archived by a peer)', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const findUnique = vi.fn().mockResolvedValue({
      id: 'form_9',
      organizationId: 'org_1',
      pdfArchiveKey: null,
      snapshotJson: SNAPSHOT,
    });
    const db = { form1042S: { findUnique, updateMany } };

    const result = await renderAndArchiveRecipientCopy(db as never, 'form_9');
    expect(result.skipped).toBe(true);
  });
});
