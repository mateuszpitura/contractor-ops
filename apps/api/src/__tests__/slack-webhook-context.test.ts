/** @vitest-environment node */

/**
 * Slack webhook context unit tests.
 *
 * Only `extractSlackTeamId` is exercised here (pure function, no IO).
 * `resolveSlackConnectionByTeamId` and `resolveOrgIdBySlug` hit Prisma +
 * Upstash and are covered by integration tests against a real DB.
 */

import { describe, expect, it } from 'vitest';

import { extractSlackTeamId } from '../lib/webhooks/slack-webhook-context.js';

describe('extractSlackTeamId', () => {
  it('reads team.id from interactivity payload', () => {
    expect(
      extractSlackTeamId({
        type: 'block_actions',
        team: { id: 'T0ABC', domain: 'x' },
      }),
    ).toBe('T0ABC');
  });

  it('reads top-level team_id', () => {
    expect(extractSlackTeamId({ team_id: 'T1XYZ', type: 'event_callback' })).toBe('T1XYZ');
  });

  it('reads event.team_id', () => {
    expect(
      extractSlackTeamId({
        type: 'event_callback',
        event: { type: 'message', team_id: 'T2DEF' },
      }),
    ).toBe('T2DEF');
  });

  it('reads authorizations[0].team_id', () => {
    expect(
      extractSlackTeamId({
        type: 'event_callback',
        authorizations: [{ team_id: 'T3GHI', user_id: 'U1', is_bot: true }],
      }),
    ).toBe('T3GHI');
  });

  it('returns undefined when no team id is present', () => {
    expect(extractSlackTeamId({})).toBeUndefined();
  });

  it('returns undefined for non-object payloads', () => {
    expect(extractSlackTeamId(null)).toBeUndefined();
    expect(extractSlackTeamId('string')).toBeUndefined();
    expect(extractSlackTeamId(42)).toBeUndefined();
  });
});
