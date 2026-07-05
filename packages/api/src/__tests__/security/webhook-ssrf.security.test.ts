/**
 * RED security net — INTEG-SEC-01 / INTEG-SEC-02 (SSRF + DNS-rebind + HTTPS-only).
 * Turned GREEN by 100-02 (`services/webhooks/ssrf-guard.ts`).
 *
 * Customer-supplied webhook URLs are hostile input. This suite is the executable
 * contract for the load-bearing control: both the subscribe-time classifier
 * (`assertWebhookUrlSafe`) and the dispatch-time connect guard (`webhookAgentLookup`,
 * the DNS-rebind / TOCTOU defence) must reject any host that is — or re-resolves
 * to — a private, loopback, link-local, ULA, unspecified, or cloud-metadata
 * address; HTTPS is required unless the caller passes the per-org HTTP override.
 * No real external URL is ever contacted — DNS is fully mocked.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const lookupMock = vi.hoisted(() => vi.fn());

vi.mock('node:dns/promises', () => ({
  lookup: lookupMock,
  default: { lookup: lookupMock },
}));

const GUARD_MODULE = '../../services/webhooks/ssrf-guard';

async function loadGuard() {
  return import(GUARD_MODULE);
}

type Addr = { address: string; family: number };

function resolvesTo(...addresses: string[]): void {
  const records: Addr[] = addresses.map(address => ({
    address,
    family: address.includes(':') ? 6 : 4,
  }));
  lookupMock.mockResolvedValue(records);
}

beforeEach(() => {
  lookupMock.mockReset();
});

describe('assertWebhookUrlSafe — subscribe-time literal-host classification (INTEG-SEC-01)', () => {
  const BLOCKED_LITERALS = [
    'https://10.0.0.1',
    'https://127.0.0.1',
    'https://169.254.169.254',
    'https://192.168.1.1',
    'https://172.16.0.1',
    'https://[::1]',
    'https://0.0.0.0',
    'https://[fe80::1]',
    'https://[fc00::1]',
  ];

  for (const url of BLOCKED_LITERALS) {
    it(`rejects the blocked literal host ${url} without a DNS lookup`, async () => {
      const { assertWebhookUrlSafe } = await loadGuard();
      await expect(assertWebhookUrlSafe(url, { httpAllowed: false })).rejects.toBeInstanceOf(Error);
      expect(lookupMock).not.toHaveBeenCalled();
    });
  }

  it('allows a public literal IP host', async () => {
    const { assertWebhookUrlSafe } = await loadGuard();
    await expect(
      assertWebhookUrlSafe('https://93.184.216.34', { httpAllowed: false }),
    ).resolves.toBeUndefined();
  });

  it('rejects the cloud-metadata address even over an http override', async () => {
    const { assertWebhookUrlSafe } = await loadGuard();
    await expect(
      assertWebhookUrlSafe('http://169.254.169.254/latest/meta-data/', { httpAllowed: true }),
    ).rejects.toBeInstanceOf(Error);
  });
});

describe('assertWebhookUrlSafe — HTTPS-only unless the per-org override (INTEG-SEC-02)', () => {
  it('rejects http:// by default', async () => {
    const { assertWebhookUrlSafe } = await loadGuard();
    await expect(
      assertWebhookUrlSafe('http://93.184.216.34', { httpAllowed: false }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('allows http:// only with the explicit override, and still SSRF-checks it', async () => {
    const { assertWebhookUrlSafe } = await loadGuard();
    await expect(
      assertWebhookUrlSafe('http://93.184.216.34', { httpAllowed: true }),
    ).resolves.toBeUndefined();
    // Override does not disable the range check.
    await expect(
      assertWebhookUrlSafe('http://10.0.0.1', { httpAllowed: true }),
    ).rejects.toBeInstanceOf(Error);
  });
});

describe('assertWebhookUrlSafe — DNS resolution classification (INTEG-SEC-01)', () => {
  it('rejects a hostname that resolves to a private address', async () => {
    const { assertWebhookUrlSafe } = await loadGuard();
    resolvesTo('10.1.2.3');
    await expect(
      assertWebhookUrlSafe('https://evil.example.com', { httpAllowed: false }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('rejects a hostname that resolves to a mix of public and private addresses', async () => {
    const { assertWebhookUrlSafe } = await loadGuard();
    resolvesTo('93.184.216.34', '10.0.0.5');
    await expect(
      assertWebhookUrlSafe('https://mixed.example.com', { httpAllowed: false }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('allows a hostname that resolves only to public addresses', async () => {
    const { assertWebhookUrlSafe } = await loadGuard();
    resolvesTo('93.184.216.34');
    await expect(
      assertWebhookUrlSafe('https://good.example.com', { httpAllowed: false }),
    ).resolves.toBeUndefined();
  });

  it('fails closed when DNS resolution errors', async () => {
    const { assertWebhookUrlSafe } = await loadGuard();
    lookupMock.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(
      assertWebhookUrlSafe('https://nxdomain.example.com', { httpAllowed: false }),
    ).rejects.toBeInstanceOf(Error);
  });
});

describe('webhookAgentLookup — connect-time DNS-rebind defence (INTEG-SEC-01, TOCTOU)', () => {
  it('errors the socket when the host re-resolves to a private address at connect', async () => {
    const { webhookAgentLookup } = await loadGuard();
    resolvesTo('10.0.0.9');
    await new Promise<void>((resolve, reject) => {
      webhookAgentLookup('rebind.example.com', { all: false }, (err: Error | null) => {
        try {
          expect(err).toBeInstanceOf(Error);
          resolve();
        } catch (assertion) {
          reject(assertion as Error);
        }
      });
    });
  });

  it('permits the socket when the host re-resolves to a public address', async () => {
    const { webhookAgentLookup } = await loadGuard();
    resolvesTo('93.184.216.34');
    await new Promise<void>((resolve, reject) => {
      webhookAgentLookup(
        'good.example.com',
        { all: false },
        (err: Error | null, address?: string) => {
          try {
            expect(err).toBeNull();
            expect(address).toBe('93.184.216.34');
            resolve();
          } catch (assertion) {
            reject(assertion as Error);
          }
        },
      );
    });
  });
});
