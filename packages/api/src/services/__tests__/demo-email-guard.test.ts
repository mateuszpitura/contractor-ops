// `sendAppEmail` is org-less (it also serves pre-tenancy auth flows), so it
// honors the GLOBAL demo signal only. A dedicated demo deploy (DEMO_MODE=true)
// sends no real email at all. Separate file because it flips DEMO_MODE globally.

import { describe, expect, it, vi } from 'vitest';

const { send } = vi.hoisted(() => {
  process.env.DEMO_MODE = 'true';
  return { send: vi.fn(async () => ({ data: { id: 'x' }, error: null })) };
});

vi.mock('../resend-client', () => ({
  getResend: vi.fn(() => ({ emails: { send } })),
}));

import { sendAppEmail } from '../app-email';

describe('sendAppEmail demo guard', () => {
  it('skips the Resend send entirely under global DEMO_MODE', async () => {
    await expect(
      sendAppEmail({
        from: 'noreply@contractor-ops.com',
        to: 'demo@example.com',
        subject: 'Hello',
        html: '<p>hi</p>',
      }),
    ).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });
});
