/**
 * Slack live-smoke — auth.test + a self-cleaning message round-trip.
 *
 * Proves: the bot token is valid and we can post + delete in a test channel.
 * Side effects: posts one message to SLACK_TEST_CHANNEL_ID, then deletes it.
 */

import { expect, it } from 'vitest';
import { smokeDescribe, smokeFetch } from './harness.js';

smokeDescribe('slack', ['SLACK_BOT_TOKEN', 'SLACK_TEST_CHANNEL_ID'], () => {
  const token = () => process.env.SLACK_BOT_TOKEN as string;
  const channel = () => process.env.SLACK_TEST_CHANNEL_ID as string;

  it('validates the bot token (auth.test)', async () => {
    const res = await smokeFetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: { authorization: `Bearer ${token()}` },
    });
    const body = (await res.json()) as { ok: boolean; error?: string };
    expect(body.ok, body.error).toBe(true);
  });

  it('posts and then deletes a message (self-cleaning)', async () => {
    const post = await smokeFetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token()}`,
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        channel: channel(),
        text: 'contractor-ops integration smoke — safe to ignore',
      }),
    });
    const posted = (await post.json()) as { ok: boolean; ts?: string; error?: string };
    expect(posted.ok, posted.error).toBe(true);
    expect(posted.ts).toBeTruthy();

    const del = await smokeFetch('https://slack.com/api/chat.delete', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token()}`,
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ channel: channel(), ts: posted.ts }),
    });
    const deleted = (await del.json()) as { ok: boolean; error?: string };
    expect(deleted.ok, deleted.error).toBe(true);
  });
});
