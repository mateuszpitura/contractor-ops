/**
 * SSRF guard for outbound webhooks — the load-bearing control of the phase.
 *
 * Customer-supplied target URLs are hostile input. Two gates run:
 *   1. `assertWebhookUrlSafe` — SUBSCRIBE + DISPATCH time: parse the URL, enforce
 *      HTTPS (unless the per-org HTTP override), reject literal IPs in blocked
 *      ranges without DNS, else resolve EVERY address and reject if any is
 *      private / loopback / link-local / ULA / unspecified / cloud-metadata.
 *   2. `webhookAgentLookup` — SOCKET-CONNECT time: re-resolve + classify at the
 *      moment the socket connects, so a name that passed the subscribe check but
 *      re-resolves to a private IP (DNS rebinding / TOCTOU) is blocked. Bound to
 *      the http/https Agents' `createConnection`. `https.request` never follows
 *      redirects, so a 302 → metadata is returned as a non-2xx, never chased.
 *
 * No third-party dependency: the connect-time re-validation is the mechanism
 * `request-filtering-agent` provides, hand-rolled with a `lookup` hook to avoid
 * a supply-chain add (see 100-02-SUMMARY).
 */

import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import { lookup as dnsLookup } from 'node:dns/promises';

import { WebhookUrlError } from './errors.js';

// ---------------------------------------------------------------------------
// IPv4 classification
// ---------------------------------------------------------------------------

interface Cidr4 {
  base: number;
  maskBits: number;
}

/** Blocked IPv4 CIDRs: this-host, RFC 1918, CGNAT, loopback, link-local
 * (incl. the cloud-metadata 169.254.169.254), IETF protocol, benchmark,
 * multicast, and reserved/broadcast. */
const BLOCKED_V4: Cidr4[] = [
  { base: ipv4ToInt('0.0.0.0'), maskBits: 8 }, // "this host"
  { base: ipv4ToInt('10.0.0.0'), maskBits: 8 }, // RFC 1918
  { base: ipv4ToInt('100.64.0.0'), maskBits: 10 }, // CGNAT
  { base: ipv4ToInt('127.0.0.0'), maskBits: 8 }, // loopback
  { base: ipv4ToInt('169.254.0.0'), maskBits: 16 }, // link-local + metadata
  { base: ipv4ToInt('172.16.0.0'), maskBits: 12 }, // RFC 1918
  { base: ipv4ToInt('192.0.0.0'), maskBits: 24 }, // IETF protocol assignments
  { base: ipv4ToInt('192.168.0.0'), maskBits: 16 }, // RFC 1918
  { base: ipv4ToInt('198.18.0.0'), maskBits: 15 }, // benchmarking
  { base: ipv4ToInt('224.0.0.0'), maskBits: 4 }, // multicast
  { base: ipv4ToInt('240.0.0.0'), maskBits: 4 }, // reserved + 255.255.255.255
].map(c => ({ base: c.base >>> 0, maskBits: c.maskBits }));

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) return -1;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return -1;
    const octet = Number(part);
    if (octet > 255) return -1;
    n = ((n << 8) | octet) >>> 0;
  }
  return n >>> 0;
}

function isBlockedIpv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value < 0) return true; // unparseable → fail closed
  return BLOCKED_V4.some(({ base, maskBits }) => {
    const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
    return (value & mask) >>> 0 === (base & mask) >>> 0;
  });
}

// ---------------------------------------------------------------------------
// IPv6 classification
// ---------------------------------------------------------------------------

/** Expand an IPv6 string (incl. `::` compression + embedded IPv4) to 8 hextets. */
function expandIpv6(input: string): number[] | null {
  let ip = input.toLowerCase();
  // Strip a zone id (fe80::1%eth0).
  const zone = ip.indexOf('%');
  if (zone !== -1) ip = ip.slice(0, zone);

  // Embedded IPv4 tail (::ffff:1.2.3.4) → two hextets.
  if (ip.includes('.')) {
    const lastColon = ip.lastIndexOf(':');
    const v4 = ipv4ToInt(ip.slice(lastColon + 1));
    if (v4 < 0) return null;
    const h1 = ((v4 >>> 16) & 0xffff).toString(16);
    const h2 = (v4 & 0xffff).toString(16);
    ip = `${ip.slice(0, lastColon + 1)}${h1}:${h2}`;
  }

  const halves = ip.split('::');
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];

  let hextets: string[];
  if (halves.length === 1) {
    if (head.length !== 8) return null;
    hextets = head;
  } else {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    hextets = [...head, ...Array<string>(missing).fill('0'), ...tail];
    if (hextets.length !== 8) return null;
  }

  const out: number[] = [];
  for (const h of hextets) {
    if (h !== '' && !/^[0-9a-f]{1,4}$/.test(h)) return null;
    out.push(parseInt(h || '0', 16));
  }
  return out;
}

function isBlockedIpv6(ip: string): boolean {
  const parsed = expandIpv6(ip);
  if (!parsed) return true; // unparseable → fail closed
  const [h0 = 0, h1 = 0, h2 = 0, h3 = 0, h4 = 0, h5 = 0, h6 = 0, h7 = 0] = parsed;

  // Unspecified (::) and loopback (::1).
  if ([h0, h1, h2, h3, h4, h5, h6, h7].every(x => x === 0)) return true;
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0 && h6 === 0 && h7 === 1) {
    return true;
  }

  // IPv4-mapped (::ffff:0:0/96) / IPv4-compatible / NAT64 (64:ff9b::/96) →
  // classify the embedded IPv4.
  const highZero = h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0;
  const isMapped = highZero && h5 === 0xffff;
  const isCompat = highZero && h5 === 0 && (h6 !== 0 || h7 !== 0);
  const isNat64 = h0 === 0x0064 && h1 === 0xff9b && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0;
  if (isMapped || isCompat || isNat64) {
    const embedded = `${(h6 >> 8) & 0xff}.${h6 & 0xff}.${(h7 >> 8) & 0xff}.${h7 & 0xff}`;
    return isBlockedIpv4(embedded);
  }

  if ((h0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((h0 & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
  if ((h0 & 0xff00) === 0xff00) return true; // ff00::/8 multicast

  return false;
}

// ---------------------------------------------------------------------------
// Public classifiers
// ---------------------------------------------------------------------------

/** True if the address falls in any blocked range. Pure + synchronous. */
export function isBlockedIp(ip: string): boolean {
  const host = ip.replace(/^\[/, '').replace(/\]$/, '');
  const kind = isIP(host);
  if (kind === 4) return isBlockedIpv4(host);
  if (kind === 6) return isBlockedIpv6(host);
  // A host that is neither a valid v4 nor v6 literal is not an IP — callers that
  // reach here passed a non-literal, which should have gone through DNS.
  return false;
}

/** True if `host` is a literal IP in a blocked range (short-circuits DNS). */
export function isBlockedHostLiteral(host: string): boolean {
  const bare = host.replace(/^\[/, '').replace(/\]$/, '');
  if (isIP(bare) === 0) return false;
  return isBlockedIp(bare);
}

// ---------------------------------------------------------------------------
// Subscribe/dispatch-time gate
// ---------------------------------------------------------------------------

export interface WebhookUrlOptions {
  /** Per-org HTTP override (INTEG-SEC-02). Default false → HTTPS required. */
  httpAllowed: boolean;
}

/**
 * Reject a webhook URL that is — or resolves to — a blocked address, or that is
 * not HTTPS (unless the per-org override). Async because a hostname needs DNS;
 * literal-IP hosts short-circuit without a lookup. Fails closed on DNS error.
 */
export async function assertWebhookUrlSafe(raw: string, opts: WebhookUrlOptions): Promise<void> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new WebhookUrlError('invalid-url', 'Webhook URL is not a valid URL');
  }

  if (url.protocol === 'http:') {
    if (!opts.httpAllowed) {
      throw new WebhookUrlError('https-required', 'Webhook URL must use https://');
    }
  } else if (url.protocol !== 'https:') {
    throw new WebhookUrlError('https-required', 'Webhook URL must use https://');
  }

  const host = url.hostname.replace(/^\[/, '').replace(/\]$/, '');

  if (isIP(host) !== 0) {
    if (isBlockedIp(host)) {
      throw new WebhookUrlError('blocked-range', 'Webhook URL host is in a blocked range');
    }
    return;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await dnsLookup(host, { all: true });
  } catch {
    throw new WebhookUrlError('unresolvable', 'Webhook URL host could not be resolved');
  }

  if (addresses.length === 0) {
    throw new WebhookUrlError('unresolvable', 'Webhook URL host resolved to no addresses');
  }
  if (addresses.some(a => isBlockedIp(a.address))) {
    throw new WebhookUrlError('resolves-private', 'Webhook URL host resolves to a blocked range');
  }
}

// ---------------------------------------------------------------------------
// Connect-time DNS-rebind guard
// ---------------------------------------------------------------------------

type LookupCallback = (
  err: Error | null,
  address?: string | Array<{ address: string; family: number }>,
  family?: number,
) => void;

/**
 * Node `Agent`/`net.connect` `lookup` hook: re-resolves the host at socket
 * connect and errors the connection if ANY resolved address is blocked. This is
 * the DNS-rebinding (TOCTOU) defence — the subscribe-time check alone is
 * bypassable by a name that re-resolves to a private IP at delivery.
 */
export function webhookAgentLookup(
  hostname: string,
  options: { all?: boolean; family?: number },
  callback: LookupCallback,
): void {
  const bare = hostname.replace(/^\[/, '').replace(/\]$/, '');
  if (isIP(bare) !== 0) {
    if (isBlockedIp(bare)) {
      callback(new WebhookUrlError('resolves-private', 'Connection host is in a blocked range'));
      return;
    }
    const family = isIP(bare) === 6 ? 6 : 4;
    callback(null, options.all ? [{ address: bare, family }] : bare, family);
    return;
  }

  dnsLookup(hostname, { all: true })
    .then(records => {
      const first = records[0];
      if (!first) {
        callback(new WebhookUrlError('unresolvable', 'Connection host resolved to no addresses'));
        return;
      }
      if (records.some(r => isBlockedIp(r.address))) {
        callback(
          new WebhookUrlError('resolves-private', 'Connection host resolves to a blocked range'),
        );
        return;
      }
      if (options.all) {
        callback(
          null,
          records.map(r => ({ address: r.address, family: r.family })),
        );
      } else {
        callback(null, first.address, first.family);
      }
    })
    .catch(() => {
      callback(new WebhookUrlError('unresolvable', 'Connection host could not be resolved'));
    });
}

// ---------------------------------------------------------------------------
// DNS-rebind-safe Agents (redirects never followed via https.request)
// ---------------------------------------------------------------------------

class WebhookHttpsAgent extends https.Agent {
  override createConnection(
    ...args: Parameters<https.Agent['createConnection']>
  ): ReturnType<https.Agent['createConnection']> {
    const [options, callback] = args;
    return super.createConnection(
      { ...(options as object), lookup: webhookAgentLookup } as Parameters<
        https.Agent['createConnection']
      >[0],
      callback,
    );
  }
}

class WebhookHttpAgent extends http.Agent {
  override createConnection(
    ...args: Parameters<http.Agent['createConnection']>
  ): ReturnType<http.Agent['createConnection']> {
    const [options, callback] = args;
    return super.createConnection(
      { ...(options as object), lookup: webhookAgentLookup } as Parameters<
        http.Agent['createConnection']
      >[0],
      callback,
    );
  }
}

/** HTTPS Agent that re-validates the resolved IP at connect (DNS-rebind guard). */
export const webhookHttpsAgent = new WebhookHttpsAgent({ keepAlive: false });

/** HTTP Agent (per-org override only); still connect-time SSRF-checked. */
export const webhookHttpAgent = new WebhookHttpAgent({ keepAlive: false });
