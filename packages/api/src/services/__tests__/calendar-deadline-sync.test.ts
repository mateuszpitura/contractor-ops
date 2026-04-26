import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock variables
// ---------------------------------------------------------------------------

const { mockCreateCalendarEvent, mockUpdateCalendarEvent } = vi.hoisted(() => ({
  mockCreateCalendarEvent: vi.fn(),
  mockUpdateCalendarEvent: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/validators', () => ({
  getServerEnv: vi.fn().mockReturnValue({
    NEXT_PUBLIC_APP_URL: 'https://app.test',
  }),
}));

vi.mock('../calendar-event-service.js', () => ({
  createCalendarEvent: mockCreateCalendarEvent,
  updateCalendarEvent: mockUpdateCalendarEvent,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  createTaskCalendarEvent,
  syncApprovalSlaDeadline,
  syncContractExpiryDeadline,
  syncPaymentDueDeadline,
} from '../calendar-deadline-sync.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 'org-1';

function makePrisma(externalLinkCount = 0) {
  return {
    externalLink: {
      count: vi.fn().mockResolvedValue(externalLinkCount),
    },
  } as never;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('syncContractExpiryDeadline', () => {
  it('creates calendar event with correct title format when no existing event', async () => {
    const prisma = makePrisma(0);

    await syncContractExpiryDeadline(prisma, {
      organizationId: ORG_ID,
      contractId: 'c-1',
      contractName: 'Annual Service',
      contractorName: 'Acme Corp',
      expiryDate: new Date('2026-06-15T00:00:00Z'),
    });

    expect(mockCreateCalendarEvent).toHaveBeenCalledOnce();
    const args = mockCreateCalendarEvent.mock.calls[0];
    expect(args[1].summary).toBe('[Contractor Ops] Contract expiry: Acme Corp - Annual Service');
    expect(args[1].entityType).toBe('CONTRACT');
    expect(args[1].entityId).toBe('c-1');
    expect(args[1].description).toContain('2026-06-15');
    expect(args[1].description).toContain('https://app.test/contracts/c-1');
  });

  it('updates existing event instead of creating a new one', async () => {
    const prisma = makePrisma(1);

    await syncContractExpiryDeadline(prisma, {
      organizationId: ORG_ID,
      contractId: 'c-1',
      contractName: 'Annual Service',
      contractorName: 'Acme Corp',
      expiryDate: new Date('2026-06-15T00:00:00Z'),
    });

    expect(mockUpdateCalendarEvent).toHaveBeenCalledOnce();
    expect(mockCreateCalendarEvent).not.toHaveBeenCalled();
    expect(mockUpdateCalendarEvent.mock.calls[0][1].summary).toContain('Contract expiry');
  });
});

describe('syncApprovalSlaDeadline', () => {
  it('creates calendar event with approval-specific title', async () => {
    const prisma = makePrisma(0);

    await syncApprovalSlaDeadline(prisma, {
      organizationId: ORG_ID,
      approvalFlowId: 'af-1',
      itemType: 'Invoice',
      itemName: 'INV-2026-001',
      deadline: new Date('2026-05-10T00:00:00Z'),
    });

    expect(mockCreateCalendarEvent).toHaveBeenCalledOnce();
    const args = mockCreateCalendarEvent.mock.calls[0];
    expect(args[1].summary).toBe('[Contractor Ops] Approval deadline: Invoice - INV-2026-001');
    expect(args[1].entityType).toBe('APPROVAL_FLOW');
    expect(args[1].entityId).toBe('af-1');
    expect(args[1].description).toContain('2026-05-10');
    expect(args[1].description).toContain('https://app.test/approvals');
  });

  it('updates existing event for the same approval flow', async () => {
    const prisma = makePrisma(1);

    await syncApprovalSlaDeadline(prisma, {
      organizationId: ORG_ID,
      approvalFlowId: 'af-1',
      itemType: 'Invoice',
      itemName: 'INV-2026-001',
      deadline: new Date('2026-05-10T00:00:00Z'),
    });

    expect(mockUpdateCalendarEvent).toHaveBeenCalledOnce();
    expect(mockCreateCalendarEvent).not.toHaveBeenCalled();
  });
});

describe('syncPaymentDueDeadline', () => {
  it('creates calendar event with payment-specific title', async () => {
    const prisma = makePrisma(0);

    await syncPaymentDueDeadline(prisma, {
      organizationId: ORG_ID,
      invoiceId: 'inv-1',
      invoiceNumber: 'INV-2026-042',
      contractorName: 'Widget Inc',
      dueDate: new Date('2026-07-01T00:00:00Z'),
    });

    expect(mockCreateCalendarEvent).toHaveBeenCalledOnce();
    const args = mockCreateCalendarEvent.mock.calls[0];
    expect(args[1].summary).toBe('[Contractor Ops] Payment due: Widget Inc - INV-2026-042');
    expect(args[1].entityType).toBe('INVOICE');
    expect(args[1].entityId).toBe('inv-1');
    expect(args[1].description).toContain('2026-07-01');
    expect(args[1].description).toContain('https://app.test/invoices/inv-1');
  });

  it('updates existing event for the same invoice', async () => {
    const prisma = makePrisma(1);

    await syncPaymentDueDeadline(prisma, {
      organizationId: ORG_ID,
      invoiceId: 'inv-1',
      invoiceNumber: 'INV-2026-042',
      contractorName: 'Widget Inc',
      dueDate: new Date('2026-07-01T00:00:00Z'),
    });

    expect(mockUpdateCalendarEvent).toHaveBeenCalledOnce();
    expect(mockCreateCalendarEvent).not.toHaveBeenCalled();
  });
});

describe('createTaskCalendarEvent', () => {
  it('substitutes template variables {contractor}, {contract}, {task}', async () => {
    const prisma = makePrisma(0);

    await createTaskCalendarEvent(prisma, {
      organizationId: ORG_ID,
      workflowTaskRunId: 'wtr-1',
      config: {
        calendarEnabled: true,
        titleTemplate: '{task} for {contractor} on {contract}',
        duration: '1h',
      } as never,
      contractorName: 'Acme Corp',
      contractName: 'Annual Service',
      taskName: 'Equipment Return',
    });

    expect(mockCreateCalendarEvent).toHaveBeenCalledOnce();
    const args = mockCreateCalendarEvent.mock.calls[0];
    expect(args[1].summary).toBe(
      '[Contractor Ops] Equipment Return for Acme Corp on Annual Service',
    );
    expect(args[1].entityType).toBe('WORKFLOW_TASK_RUN');
    expect(args[1].entityId).toBe('wtr-1');
  });

  it('uses default template when titleTemplate is not provided', async () => {
    const prisma = makePrisma(0);

    await createTaskCalendarEvent(prisma, {
      organizationId: ORG_ID,
      workflowTaskRunId: 'wtr-2',
      config: {
        calendarEnabled: true,
        titleTemplate: undefined,
        duration: '30m',
      } as never,
      contractorName: 'Bob',
      contractName: 'Q2 Contract',
      taskName: 'Review',
    });

    const args = mockCreateCalendarEvent.mock.calls[0];
    expect(args[1].summary).toBe('[Contractor Ops] Review - Bob (Q2 Contract)');
  });

  it('maps duration correctly for 2h', async () => {
    const prisma = makePrisma(0);

    await createTaskCalendarEvent(prisma, {
      organizationId: ORG_ID,
      workflowTaskRunId: 'wtr-3',
      config: {
        calendarEnabled: true,
        duration: '2h',
      } as never,
      contractorName: 'X',
      contractName: 'Y',
      taskName: 'Z',
    });

    const args = mockCreateCalendarEvent.mock.calls[0];
    const start = new Date(args[1].startDateTime);
    const end = new Date(args[1].endDateTime);
    const durationMs = end.getTime() - start.getTime();
    expect(durationMs).toBe(2 * 60 * 60 * 1000);
  });

  it('maps full_day duration to end-of-day', async () => {
    const prisma = makePrisma(0);

    await createTaskCalendarEvent(prisma, {
      organizationId: ORG_ID,
      workflowTaskRunId: 'wtr-4',
      config: {
        calendarEnabled: true,
        duration: 'full_day',
      } as never,
      contractorName: 'X',
      contractName: 'Y',
      taskName: 'Z',
    });

    const args = mockCreateCalendarEvent.mock.calls[0];
    const end = new Date(args[1].endDateTime);
    expect(end.getUTCHours()).toBe(23);
    expect(end.getUTCMinutes()).toBe(59);
  });

  it('no-ops when calendarEnabled is false', async () => {
    const prisma = makePrisma(0);

    await createTaskCalendarEvent(prisma, {
      organizationId: ORG_ID,
      workflowTaskRunId: 'wtr-5',
      config: {
        calendarEnabled: false,
        duration: '1h',
      } as never,
      contractorName: 'X',
      contractName: 'Y',
      taskName: 'Z',
    });

    expect(mockCreateCalendarEvent).not.toHaveBeenCalled();
  });
});
