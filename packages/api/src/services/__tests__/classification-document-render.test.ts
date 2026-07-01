/**
 * renderDeterminationLetterPdfBuffer — archive + audit lifecycle.
 *
 * Proves the US Classification Determination Letter render:
 *   - archives an append-only ClassificationDocument row (create only; never
 *     update/delete) with kind US_DETERMINATION_LETTER;
 *   - freezes ruleSetVersion from the assessment SNAPSHOT, never from the
 *     outcome payload or a live re-score;
 *   - audit-logs generation with the determination-letter action;
 *   - guards on assessment completion + outcome kind;
 *   - skips the row insert + audit on a re-render (classificationDocumentId
 *     supplied) so re-signing stays byte-exact without a duplicate row.
 *
 * Prisma, R2, @react-pdf/renderer, the template, and the audit writer are all
 * mocked so the test runs without a DB and without a real PDF render.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockR2, mockRenderer, mockAudit } = vi.hoisted(() => {
  // biome-ignore lint/suspicious/noExplicitAny: test double record
  type AnyRec = Record<string, any>;

  const mockPrisma: AnyRec = {
    classificationAssessment: {
      findFirstOrThrow: vi.fn(),
    },
    classificationDocument: {
      create: vi.fn(async (opts: { data: AnyRec }) => ({ id: 'doc_new_1', ...opts.data })),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  const mockR2 = { deleteObject: vi.fn(async () => undefined) };
  const mockRenderer = {
    renderToBuffer: vi.fn(async () => Buffer.from('determination-letter-bytes')),
  };
  const mockAudit = { writeAuditLog: vi.fn(async () => undefined) };

  return { mockPrisma, mockR2, mockRenderer, mockAudit };
});

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
}));

vi.mock('@contractor-ops/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../r2', () => mockR2);
// Keep the real StyleSheet/Document/Page primitives (the sibling SDS + DRV
// templates call StyleSheet.create at import) — only stub renderToBuffer so no
// real PDF is produced.
vi.mock('@react-pdf/renderer', async importOriginal => {
  const actual = await importOriginal<typeof import('@react-pdf/renderer')>();
  return { ...actual, renderToBuffer: mockRenderer.renderToBuffer };
});
vi.mock('../audit-writer', () => mockAudit);

vi.mock('../../pdf-templates/us-determination-letter', () => ({
  UsDeterminationLetterDocument: vi.fn(() => ({ _template: 'us-determination-letter' })),
  RENDERER_SLUG: 'us-determination-letter',
  TEMPLATE_VERSION: 1,
}));

// Imported after mocks are registered.
const { renderDeterminationLetterPdfBuffer } = await import('../classification-document-render');

const ORG_ID = 'clorg00000000000000000001';
const ASSESSMENT_ID = 'classess0000000000000000001';
const USER_ID = 'cluser00000000000000000001';
const FROZEN_RULE_SET = 'US-2026-COMMONLAW-AB5';

function makeAssessment(overrides: Record<string, unknown> = {}) {
  return {
    id: ASSESSMENT_ID,
    organizationId: ORG_ID,
    ruleSetVersion: FROZEN_RULE_SET,
    status: 'COMPLETED',
    completedAt: new Date('2026-06-01T00:00:00.000Z'),
    questionsSnapshot: { questions: [] },
    answers: {},
    // Deliberately DIFFERENT from the frozen assessment.ruleSetVersion — the row
    // must copy the assessment value, never the outcome payload.
    outcome: { kind: 'US_CLASSIFICATION', ruleSetVersion: 'US-STALE-OUTCOME-VERSION' },
    contractorAssignment: {
      id: 'cleng00000000000000000001',
      activeFrom: new Date('2026-01-01T00:00:00.000Z'),
      activeTo: null,
      contractor: { id: 'clrec00000000000000000001', displayName: 'Jean Contractor' },
      organization: { id: ORG_ID, name: 'Acme Org', countryCode: 'US' },
    },
    ...overrides,
  };
}

beforeEach(() => {
  mockPrisma.classificationAssessment.findFirstOrThrow.mockReset();
  mockPrisma.classificationDocument.create.mockClear();
  mockPrisma.classificationDocument.update.mockClear();
  mockPrisma.classificationDocument.delete.mockClear();
  mockR2.deleteObject.mockClear();
  mockRenderer.renderToBuffer.mockClear();
  mockAudit.writeAuditLog.mockClear();
});

describe('renderDeterminationLetterPdfBuffer', () => {
  it('archives an append-only row with kind + ruleSetVersion frozen from the assessment', async () => {
    mockPrisma.classificationAssessment.findFirstOrThrow.mockResolvedValue(makeAssessment());

    const result = await renderDeterminationLetterPdfBuffer({
      organizationId: ORG_ID,
      classificationAssessmentId: ASSESSMENT_ID,
      requestedByUserId: USER_ID,
    });

    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.documentId).toBe('doc_new_1');

    expect(mockPrisma.classificationDocument.create).toHaveBeenCalledTimes(1);
    const createData = mockPrisma.classificationDocument.create.mock.calls[0][0].data;
    expect(createData.kind).toBe('US_DETERMINATION_LETTER');
    expect(createData.ruleSetVersion).toBe(FROZEN_RULE_SET);
    expect(createData.organizationId).toBe(ORG_ID);
    expect(createData.generatedByUserId).toBe(USER_ID);
    expect(createData.sha256Hash).toMatch(/^[a-f0-9]{64}$/);

    // Append-only: never mutate or remove an archived letter row.
    expect(mockPrisma.classificationDocument.update).not.toHaveBeenCalled();
    expect(mockPrisma.classificationDocument.delete).not.toHaveBeenCalled();
  });

  it('audit-logs generation with the determination-letter action + actor + tenant', async () => {
    mockPrisma.classificationAssessment.findFirstOrThrow.mockResolvedValue(makeAssessment());

    await renderDeterminationLetterPdfBuffer({
      organizationId: ORG_ID,
      classificationAssessmentId: ASSESSMENT_ID,
      requestedByUserId: USER_ID,
    });

    expect(mockAudit.writeAuditLog).toHaveBeenCalledTimes(1);
    const auditArg = mockAudit.writeAuditLog.mock.calls[0][0];
    expect(auditArg.action).toBe('classification.determinationLetter.generate');
    expect(auditArg.organizationId).toBe(ORG_ID);
    expect(auditArg.actorType).toBe('USER');
    expect(auditArg.actorId).toBe(USER_ID);
    expect(auditArg.resourceType).toBe('DOCUMENT');
    expect(auditArg.resourceId).toBe('doc_new_1');
    expect(auditArg.metadata).toMatchObject({
      kind: 'US_DETERMINATION_LETTER',
      ruleSetVersion: FROZEN_RULE_SET,
    });
  });

  it('records a SYSTEM actor when no requesting user is supplied', async () => {
    mockPrisma.classificationAssessment.findFirstOrThrow.mockResolvedValue(makeAssessment());

    await renderDeterminationLetterPdfBuffer({
      organizationId: ORG_ID,
      classificationAssessmentId: ASSESSMENT_ID,
      requestedByUserId: null,
    });

    const auditArg = mockAudit.writeAuditLog.mock.calls[0][0];
    expect(auditArg.actorType).toBe('SYSTEM');
  });

  it('rejects a non-US outcome (only US worker-classification assessments)', async () => {
    mockPrisma.classificationAssessment.findFirstOrThrow.mockResolvedValue(
      makeAssessment({ outcome: { kind: 'IR35' } }),
    );

    await expect(
      renderDeterminationLetterPdfBuffer({
        organizationId: ORG_ID,
        classificationAssessmentId: ASSESSMENT_ID,
        requestedByUserId: USER_ID,
      }),
    ).rejects.toThrow(/US worker-classification/i);

    expect(mockPrisma.classificationDocument.create).not.toHaveBeenCalled();
    expect(mockAudit.writeAuditLog).not.toHaveBeenCalled();
  });

  it('rejects an assessment that is not completed', async () => {
    mockPrisma.classificationAssessment.findFirstOrThrow.mockResolvedValue(
      makeAssessment({ status: 'DRAFT', questionsSnapshot: null }),
    );

    await expect(
      renderDeterminationLetterPdfBuffer({
        organizationId: ORG_ID,
        classificationAssessmentId: ASSESSMENT_ID,
        requestedByUserId: USER_ID,
      }),
    ).rejects.toThrow(/completed/i);

    expect(mockPrisma.classificationDocument.create).not.toHaveBeenCalled();
    expect(mockAudit.writeAuditLog).not.toHaveBeenCalled();
  });

  it('reuses an existing document on re-render without inserting a duplicate row or re-auditing', async () => {
    mockPrisma.classificationAssessment.findFirstOrThrow.mockResolvedValue(makeAssessment());

    const result = await renderDeterminationLetterPdfBuffer({
      organizationId: ORG_ID,
      classificationAssessmentId: ASSESSMENT_ID,
      classificationDocumentId: 'doc_existing_1',
      requestedByUserId: USER_ID,
    });

    expect(result.documentId).toBe('doc_existing_1');
    expect(mockPrisma.classificationDocument.create).not.toHaveBeenCalled();
    expect(mockAudit.writeAuditLog).not.toHaveBeenCalled();
  });
});
