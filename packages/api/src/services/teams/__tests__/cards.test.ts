import { describe, expect, it } from 'vitest';
import { buildActivityAlertCard } from '../cards/activity-alert-card.js';
import { buildApprovalCard } from '../cards/approval-card.js';
import { buildApprovalReminderCard } from '../cards/approval-reminder-card.js';
import { buildApprovalResultCard } from '../cards/approval-result-card.js';
import { buildRejectModalCard } from '../cards/reject-modal-card.js';

// ---------------------------------------------------------------------------
// Shared assertions
// ---------------------------------------------------------------------------

function assertAdaptiveCard(card: Record<string, unknown>) {
  expect(card.type).toBe('AdaptiveCard');
  expect(card.version).toBe('1.4');
  expect(card.$schema).toBe('http://adaptivecards.io/schemas/adaptive-card.json');
}

// ---------------------------------------------------------------------------
// buildApprovalCard
// ---------------------------------------------------------------------------

describe('buildApprovalCard', () => {
  const params = {
    invoiceNumber: 'INV-2024-001',
    contractorName: 'Acme Corp',
    amount: '5000',
    currency: 'PLN',
    dueDate: '2024-04-15',
    invoiceId: 'inv_123',
    flowId: 'flow_456',
  };

  it('returns a valid Adaptive Card v1.4', () => {
    const card = buildApprovalCard(params);
    assertAdaptiveCard(card);
  });

  it("has header text 'Invoice Approval Required'", () => {
    const card = buildApprovalCard(params);
    const body = card.body as Record<string, unknown>[];
    const header = body.find(b => b.type === 'TextBlock' && b.text === 'Invoice Approval Required');
    expect(header).toBeDefined();
    expect(header?.weight).toBe('Bolder');
    expect(header?.size).toBe('Medium');
  });

  it('includes FactSet with invoice details', () => {
    const card = buildApprovalCard(params);
    const body = card.body as Record<string, unknown>[];
    const factSet = body.find(b => b.type === 'FactSet');
    expect(factSet).toBeDefined();

    const facts = factSet?.facts as Array<{
      title: string;
      value: string;
    }>;
    expect(facts).toEqual(
      expect.arrayContaining([
        { title: 'Invoice', value: 'INV-2024-001' },
        { title: 'Contractor', value: 'Acme Corp' },
        { title: 'Amount', value: '5000 PLN' },
        { title: 'Due Date', value: '2024-04-15' },
      ]),
    );
  });

  it('has exactly 2 actions (Approve and Reject)', () => {
    const card = buildApprovalCard(params);
    const actions = card.actions as Record<string, unknown>[];
    expect(actions).toHaveLength(2);
  });

  it('has Approve button with positive style and correct data', () => {
    const card = buildApprovalCard(params);
    const actions = card.actions as Record<string, unknown>[];
    const approve = actions[0]!;

    expect(approve.title).toBe('Approve');
    expect(approve.style).toBe('positive');
    expect(approve.data).toEqual({
      action: 'approve_invoice',
      invoiceId: 'inv_123',
      flowId: 'flow_456',
    });
  });

  it('has Reject button with destructive style and msteams task/fetch', () => {
    const card = buildApprovalCard(params);
    const actions = card.actions as Record<string, unknown>[];
    const reject = actions[1]!;

    expect(reject.title).toBe('Reject');
    expect(reject.style).toBe('destructive');

    const data = reject.data as Record<string, unknown>;
    expect(data.action).toBe('reject_invoice');
    expect(data.invoiceId).toBe('inv_123');
    expect(data.flowId).toBe('flow_456');

    // Critical: msteams task/fetch triggers the rejection modal
    const msteams = data.msteams as Record<string, unknown>;
    expect(msteams.type).toBe('task/fetch');
  });
});

// ---------------------------------------------------------------------------
// buildApprovalResultCard
// ---------------------------------------------------------------------------

describe('buildApprovalResultCard', () => {
  it('returns a valid Adaptive Card v1.4 for approval', () => {
    const card = buildApprovalResultCard({
      result: 'approved',
      invoiceNumber: 'INV-001',
      amount: '1000',
      currency: 'EUR',
      approverName: 'John Doe',
      viewUrl: 'https://app.example.com/invoices/123',
    });
    assertAdaptiveCard(card);
  });

  it('shows checkmark for approved result', () => {
    const card = buildApprovalResultCard({
      result: 'approved',
      invoiceNumber: 'INV-001',
      amount: '1000',
      currency: 'EUR',
      approverName: 'John Doe',
      viewUrl: 'https://app.example.com/invoices/123',
    });
    const body = card.body as Record<string, unknown>[];
    const header = body[0]!;
    expect(header.text).toContain('\u2705');
    expect(header.text).toContain('Approved');
    expect(header.color).toBe('Good');
  });

  it('shows X for rejected result', () => {
    const card = buildApprovalResultCard({
      result: 'rejected',
      invoiceNumber: 'INV-001',
      amount: '1000',
      currency: 'EUR',
      approverName: 'Jane Doe',
      comment: 'Incorrect amount',
      viewUrl: 'https://app.example.com/invoices/123',
    });
    const body = card.body as Record<string, unknown>[];
    const header = body[0]!;
    expect(header.text).toContain('\u274C');
    expect(header.text).toContain('Rejected');
    expect(header.color).toBe('Attention');
  });

  it('includes rejection comment when provided', () => {
    const card = buildApprovalResultCard({
      result: 'rejected',
      invoiceNumber: 'INV-001',
      amount: '1000',
      currency: 'EUR',
      approverName: 'Jane Doe',
      comment: 'Incorrect amount',
      viewUrl: 'https://app.example.com/invoices/123',
    });
    const body = card.body as Record<string, unknown>[];
    const commentBlock = body.find(
      b =>
        b.type === 'TextBlock' &&
        typeof b.text === 'string' &&
        (b.text as string).includes('Incorrect amount'),
    );
    expect(commentBlock).toBeDefined();
  });

  it('has View in Contractor Ops action', () => {
    const card = buildApprovalResultCard({
      result: 'approved',
      invoiceNumber: 'INV-001',
      amount: '1000',
      currency: 'EUR',
      approverName: 'John Doe',
      viewUrl: 'https://app.example.com/invoices/123',
    });
    const actions = card.actions as Record<string, unknown>[];
    expect(actions).toHaveLength(1);
    expect(actions[0]?.type).toBe('Action.OpenUrl');
    expect(actions[0]?.title).toBe('View in Contractor Ops');
    expect(actions[0]?.url).toBe('https://app.example.com/invoices/123');
  });
});

// ---------------------------------------------------------------------------
// buildActivityAlertCard
// ---------------------------------------------------------------------------

describe('buildActivityAlertCard', () => {
  it('returns a valid Adaptive Card v1.4', () => {
    const card = buildActivityAlertCard({
      title: 'New Invoice Submitted',
      details: [
        { label: 'Invoice', value: 'INV-001' },
        { label: 'Amount', value: '2000 PLN' },
      ],
      viewUrl: 'https://app.example.com/invoices/123',
    });
    assertAdaptiveCard(card);
  });

  it('maps details to FactSet', () => {
    const card = buildActivityAlertCard({
      title: 'New Invoice Submitted',
      details: [
        { label: 'Invoice', value: 'INV-001' },
        { label: 'Contractor', value: 'Acme' },
      ],
      viewUrl: 'https://app.example.com/invoices/123',
    });
    const body = card.body as Record<string, unknown>[];
    const factSet = body.find(b => b.type === 'FactSet');
    expect(factSet).toBeDefined();

    const facts = factSet?.facts as Array<{
      title: string;
      value: string;
    }>;
    expect(facts).toEqual([
      { title: 'Invoice', value: 'INV-001' },
      { title: 'Contractor', value: 'Acme' },
    ]);
  });

  it('has Action.OpenUrl to Contractor Ops', () => {
    const card = buildActivityAlertCard({
      title: 'Test',
      details: [],
      viewUrl: 'https://example.com',
    });
    const actions = card.actions as Record<string, unknown>[];
    expect(actions[0]?.type).toBe('Action.OpenUrl');
    expect(actions[0]?.url).toBe('https://example.com');
  });
});

// ---------------------------------------------------------------------------
// buildApprovalReminderCard
// ---------------------------------------------------------------------------

describe('buildApprovalReminderCard', () => {
  const params = {
    overdueInDays: 3,
    invoiceNumber: 'INV-001',
    contractorName: 'Acme Corp',
    amount: '5000',
    currency: 'PLN',
    dueDate: '2024-04-01',
    invoiceId: 'inv_123',
    flowId: 'flow_456',
  };

  it('returns a valid Adaptive Card v1.4', () => {
    const card = buildApprovalReminderCard(params);
    assertAdaptiveCard(card);
  });

  it("has header 'Overdue Approval Reminder'", () => {
    const card = buildApprovalReminderCard(params);
    const body = card.body as Record<string, unknown>[];
    expect(body[0]?.text).toBe('Overdue Approval Reminder');
  });

  it('shows overdue days with Attention color', () => {
    const card = buildApprovalReminderCard(params);
    const body = card.body as Record<string, unknown>[];
    const overdue = body[1]!;
    expect(overdue.text).toBe('3 days overdue');
    expect(overdue.color).toBe('Attention');
  });

  it('has approve/reject actions like approval card', () => {
    const card = buildApprovalReminderCard(params);
    const actions = card.actions as Record<string, unknown>[];
    expect(actions).toHaveLength(2);

    expect(actions[0]?.title).toBe('Approve');
    expect(actions[0]?.style).toBe('positive');

    expect(actions[1]?.title).toBe('Reject');
    expect(actions[1]?.style).toBe('destructive');

    const rejectData = actions[1]?.data as Record<string, unknown>;
    const msteams = rejectData.msteams as Record<string, unknown>;
    expect(msteams.type).toBe('task/fetch');
  });
});

// ---------------------------------------------------------------------------
// buildRejectModalCard
// ---------------------------------------------------------------------------

describe('buildRejectModalCard', () => {
  it('returns a valid Adaptive Card v1.4', () => {
    const card = buildRejectModalCard('inv_123', 'flow_456');
    assertAdaptiveCard(card);
  });

  it('has a required multiline text input for rejection reason', () => {
    const card = buildRejectModalCard('inv_123', 'flow_456');
    const body = card.body as Record<string, unknown>[];
    const input = body.find(b => b.type === 'Input.Text');
    expect(input).toBeDefined();
    expect(input?.id).toBe('comment');
    expect(input?.isRequired).toBe(true);
    expect(input?.isMultiline).toBe(true);
  });

  it('has submit action with submit_rejection data', () => {
    const card = buildRejectModalCard('inv_123', 'flow_456');
    const actions = card.actions as Record<string, unknown>[];
    expect(actions).toHaveLength(1);

    const data = actions[0]?.data as Record<string, unknown>;
    expect(data.action).toBe('submit_rejection');
    expect(data.invoiceId).toBe('inv_123');
    expect(data.flowId).toBe('flow_456');
  });
});
