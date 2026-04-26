import { mockId } from '../utils.js';

/**
 * Webhook fixture payloads for simulating inbound webhooks.
 * These are the payloads your system receives FROM external services.
 * Use with your app's webhook endpoint tests.
 */
export const webhookPayloads = {
  stripe: {
    invoicePaid: (overrides?: Record<string, unknown>) => ({
      id: `evt_${mockId().replace(/-/g, '').slice(0, 14)}`,
      type: 'invoice.paid',
      data: {
        object: {
          id: `in_${mockId().replace(/-/g, '').slice(0, 14)}`,
          object: 'invoice',
          status: 'paid',
          amount_due: 4900,
          amount_paid: 4900,
          currency: 'pln',
          customer: `cus_${mockId().replace(/-/g, '').slice(0, 14)}`,
          subscription: `sub_${mockId().replace(/-/g, '').slice(0, 14)}`,
          ...overrides,
        },
      },
      created: Math.floor(Date.now() / 1000),
      livemode: false,
    }),
    subscriptionUpdated: (overrides?: Record<string, unknown>) => ({
      id: `evt_${mockId().replace(/-/g, '').slice(0, 14)}`,
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: `sub_${mockId().replace(/-/g, '').slice(0, 14)}`,
          object: 'subscription',
          status: 'active',
          cancel_at_period_end: false,
          ...overrides,
        },
      },
      created: Math.floor(Date.now() / 1000),
      livemode: false,
    }),
    subscriptionDeleted: (overrides?: Record<string, unknown>) => ({
      id: `evt_${mockId().replace(/-/g, '').slice(0, 14)}`,
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: `sub_${mockId().replace(/-/g, '').slice(0, 14)}`,
          object: 'subscription',
          status: 'canceled',
          ...overrides,
        },
      },
      created: Math.floor(Date.now() / 1000),
      livemode: false,
    }),
  },

  jira: {
    // NOTE: Production only subscribes to jira:issue_updated (not jira:issue_created).
    // The webhook handler processes status changes via changelog.
    issueUpdated: (overrides?: Record<string, unknown>) => ({
      webhookEvent: 'jira:issue_updated',
      timestamp: Date.now(),
      issue: {
        id: '10001',
        key: 'TEST-1',
        fields: {
          summary: 'Updated Issue',
          status: { id: '3', name: 'In Progress', statusCategory: { key: 'indeterminate' } },
          ...overrides,
        },
      },
      changelog: {
        items: [
          {
            field: 'status',
            fromString: 'To Do',
            toString: 'In Progress',
          },
        ],
      },
    }),
    // NOTE: worklog sync uses polling (jira-worklog-sync.ts), not webhooks.
    // No worklog_created webhook fixture needed.
  },

  linear: {
    issueCreated: (overrides?: Record<string, unknown>) => ({
      type: 'Issue',
      action: 'create',
      data: {
        id: mockId(),
        identifier: 'ENG-100',
        title: 'New Linear Issue',
        state: { id: 'state-todo', name: 'Todo', type: 'unstarted' },
        team: { id: 'team-001', key: 'ENG' },
        assignee: null,
        ...overrides,
      },
      createdAt: new Date().toISOString(),
    }),
    issueUpdated: (overrides?: Record<string, unknown>) => ({
      type: 'Issue',
      action: 'update',
      data: {
        id: mockId(),
        identifier: 'ENG-100',
        title: 'Updated Linear Issue',
        state: { id: 'state-progress', name: 'In Progress', type: 'started' },
        ...overrides,
      },
      updatedFrom: {
        stateId: 'state-todo',
      },
      createdAt: new Date().toISOString(),
    }),
  },

  docusign: {
    envelopeCompleted: (overrides?: Record<string, unknown>) => ({
      event: 'envelope-completed',
      apiVersion: 'v2.1',
      uri: '/restapi/v2.1/accounts/acct-001/envelopes/env-001',
      retryCount: 0,
      configurationId: 'config-001',
      generatedDateTime: new Date().toISOString(),
      data: {
        accountId: 'acct-001',
        envelopeId: mockId(),
        envelopeSummary: {
          status: 'completed',
          recipients: {
            signers: [
              {
                recipientId: '1',
                email: 'contractor@example.com',
                name: 'Test Contractor',
                status: 'completed',
                signedDateTime: new Date().toISOString(),
              },
            ],
          },
          ...overrides,
        },
      },
    }),
    envelopeVoided: (overrides?: Record<string, unknown>) => ({
      event: 'envelope-voided',
      data: {
        accountId: 'acct-001',
        envelopeId: mockId(),
        envelopeSummary: {
          status: 'voided',
          voidedReason: 'Contract cancelled',
          ...overrides,
        },
      },
    }),
  },

  autenti: {
    documentCompleted: (overrides?: Record<string, unknown>) => ({
      documentProcessId: mockId(),
      id: mockId(),
      status: 'COMPLETED',
      eventId: mockId(),
      occurredAt: new Date().toISOString(),
      ...overrides,
    }),
  },

  slack: {
    viewSubmission: (overrides?: Record<string, unknown>) => ({
      type: 'view_submission',
      user: { id: 'U_USER_001', name: 'testuser' },
      view: {
        id: 'V_MOCK',
        type: 'modal',
        callback_id: 'approval_modal',
        private_metadata: JSON.stringify({ contractId: 'contract-001' }),
        state: {
          values: {
            approval_block: {
              approval_action: { type: 'static_select', selected_option: { value: 'approved' } },
            },
          },
        },
        ...overrides,
      },
    }),
    interactiveMessage: (overrides?: Record<string, unknown>) => ({
      type: 'block_actions',
      user: { id: 'U_USER_001', name: 'testuser' },
      actions: [
        {
          action_id: 'approve_contract',
          block_id: 'approval_block',
          type: 'button',
          value: 'approve',
        },
      ],
      message: { ts: '1234567890.000001' },
      channel: { id: 'C_MOCK' },
      ...overrides,
    }),
  },

  resend: {
    emailDelivered: (overrides?: Record<string, unknown>) => ({
      type: 'email.delivered',
      created_at: new Date().toISOString(),
      data: {
        email_id: mockId(),
        to: ['contractor@example.com'],
        from: 'noreply@contractorhub.io',
        subject: 'Test Email',
        ...overrides,
      },
    }),
    emailBounced: (overrides?: Record<string, unknown>) => ({
      type: 'email.bounced',
      created_at: new Date().toISOString(),
      data: {
        email_id: mockId(),
        to: ['invalid@example.com'],
        from: 'noreply@contractorhub.io',
        bounce: { type: 'hard', message: 'Mailbox not found' },
        ...overrides,
      },
    }),
  },
} as const;

/**
 * Duplicate the same webhook payload to simulate webhook replay/retry.
 * Returns an array with the payload repeated `times` times, each with the same ID.
 */
export function replayWebhook<T extends Record<string, unknown>>(payload: T, times: number): T[] {
  return Array.from({ length: times }, () => ({ ...payload }));
}
