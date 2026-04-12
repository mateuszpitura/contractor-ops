import { HttpResponse, http } from 'msw';
import { mockId } from '../utils.js';

/**
 * Webhook edge case handlers:
 * - Duplicate delivery within dedup window
 * - Invalid/tampered signature
 * - Loop prevention timing (Linear 30s window)
 * - Stripe signature mismatch
 */

/**
 * Linear webhook handler that tracks calls to simulate dedup window behavior.
 * Returns the same issue data each time — your system should deduplicate.
 */
export function linearWebhookDuplicateDelivery() {
  const deliveries: Array<{ timestamp: number; actionId: string }> = [];

  return {
    handlers: [
      http.post('https://api.linear.app/graphql', ({ request }) => {
        // Always return success for any GraphQL call during webhook processing
        return HttpResponse.json({
          data: {
            workflowState: {
              id: 'state-progress',
              name: 'In Progress',
              type: 'started',
            },
          },
        });
      }),
    ],

    /**
     * Generate N identical webhook payloads for dedup testing.
     * All share the same issue ID to test whether the system deduplicates.
     */
    createDuplicatePayloads(count: number) {
      const issueId = mockId();
      const now = Date.now();

      return Array.from({ length: count }, (_, i) => ({
        type: 'Issue',
        action: 'update',
        data: {
          id: issueId,
          identifier: 'ENG-100',
          title: 'Same Issue Updated',
          stateId: 'state-progress',
          teamId: 'team-001',
          state: { id: 'state-progress', name: 'In Progress', type: 'started' },
        },
        updatedFrom: { stateId: 'state-todo' },
        // Each delivery has slightly different timestamp
        createdAt: new Date(now + i * 500).toISOString(),
      }));
    },

    /** Access delivery log for assertions */
    get deliveries() {
      return deliveries;
    },
  };
}

/**
 * Webhook payloads with invalid signatures for testing rejection.
 */
export const invalidSignaturePayloads = {
  /** Stripe event with tampered body (signature won't match) */
  stripe: {
    payload: JSON.stringify({
      id: 'evt_tampered',
      type: 'invoice.paid',
      data: { object: { id: 'in_tampered', status: 'paid' } },
    }),
    headers: {
      'stripe-signature': 't=1234567890,v1=invalid_signature_that_wont_match',
    },
  },

  /** Jira webhook with wrong HMAC */
  jira: {
    payload: JSON.stringify({
      webhookEvent: 'jira:issue_updated',
      issue: { key: 'TEST-1', fields: { summary: 'Tampered' } },
    }),
    headers: {
      'x-hub-signature': 'sha256=0000000000000000000000000000000000000000000000000000000000000000',
    },
  },

  /** Linear webhook with wrong signature */
  linear: {
    payload: JSON.stringify({
      type: 'Issue',
      action: 'update',
      data: { id: 'tampered', identifier: 'ENG-999' },
    }),
    headers: {
      'linear-signature': '0000000000000000000000000000000000000000000000000000000000000000',
    },
  },

  /** Slack webhook with wrong signature */
  slack: {
    payload: 'payload=%7B%22type%22%3A%22block_actions%22%7D',
    headers: {
      'x-slack-request-timestamp': String(Math.floor(Date.now() / 1000)),
      'x-slack-signature': 'v0=invalid_signature',
    },
  },

  /** DocuSign webhook with wrong HMAC */
  docusign: {
    payload: JSON.stringify({
      event: 'envelope-completed',
      data: { envelopeId: 'tampered' },
    }),
    headers: {
      'x-docusign-signature-1': 'invalid_base64_signature==',
    },
  },

  /** Autenti webhook with wrong signature */
  autenti: {
    payload: JSON.stringify({
      documentProcessId: 'tampered',
      status: 'COMPLETED',
    }),
    headers: {
      'x-autenti-signature': '0000000000000000000000000000000000000000000000000000000000000000',
    },
  },

  /** Resend webhook with wrong Svix signature */
  resend: {
    payload: JSON.stringify({
      type: 'email.delivered',
      data: { email_id: 'tampered' },
    }),
    headers: {
      'svix-id': 'msg_tampered',
      'svix-timestamp': String(Math.floor(Date.now() / 1000)),
      'svix-signature': 'v1,invalid_signature',
    },
  },
} as const;

/**
 * Linear loop prevention scenario.
 * Simulates the case where an outbound sync just happened (< 30s ago)
 * and an inbound webhook arrives for the same issue.
 * The system should suppress processing to avoid infinite loops.
 */
export function linearLoopPreventionPayloads() {
  const issueId = mockId();
  const now = Date.now();

  return {
    /** The outbound sync happened at this time */
    outboundSyncTimestamp: new Date(now).toISOString(),

    /** Webhook that arrives 5s later — should be SUPPRESSED */
    webhookAt5s: {
      type: 'Issue',
      action: 'update',
      data: {
        id: issueId,
        identifier: 'ENG-200',
        title: 'Loop Test Issue',
        stateId: 'state-progress',
        teamId: 'team-001',
      },
      updatedFrom: { stateId: 'state-todo' },
      createdAt: new Date(now + 5_000).toISOString(),
    },

    /** Webhook that arrives 29s later — should be SUPPRESSED (within 30s window) */
    webhookAt29s: {
      type: 'Issue',
      action: 'update',
      data: {
        id: issueId,
        identifier: 'ENG-200',
        title: 'Loop Test Issue',
        stateId: 'state-done',
        teamId: 'team-001',
      },
      updatedFrom: { stateId: 'state-progress' },
      createdAt: new Date(now + 29_000).toISOString(),
    },

    /** Webhook that arrives 31s later — should be PROCESSED (outside 30s window) */
    webhookAt31s: {
      type: 'Issue',
      action: 'update',
      data: {
        id: issueId,
        identifier: 'ENG-200',
        title: 'Loop Test Issue',
        stateId: 'state-cancelled',
        teamId: 'team-001',
      },
      updatedFrom: { stateId: 'state-done' },
      createdAt: new Date(now + 31_000).toISOString(),
    },
  };
}
