// TODO(production-hardening): security@<domain> contact + PGP key URL must be
// set via env (NEXT_PUBLIC_SECURITY_CONTACT, NEXT_PUBLIC_SECURITY_PGP_URL) or
// hardcoded by the maintainer before merging this commit.
//
// RFC 9116 security.txt — exposes the security contact, PGP key URL, policy
// URL, and expiry so researchers can responsibly disclose vulnerabilities.
// Served as text/plain at /.well-known/security.txt with a 1h CDN cache.

import { NextResponse } from 'next/server';

const DEFAULT_CONTACT = 'mailto:security@contractor-ops.io';
const DEFAULT_CANONICAL = 'https://contractor-ops.io/.well-known/security.txt';
const DEFAULT_ENCRYPTION = 'https://contractor-ops.io/.well-known/pgp-key.txt';
const DEFAULT_POLICY = 'https://contractor-ops.io/security/policy';
const DEFAULT_EXPIRES = '2027-05-16T00:00:00.000Z';
const DEFAULT_LANGUAGES = 'en, de, pl';

export const dynamic = 'force-static';
export const revalidate = 3600;

export function GET(): NextResponse {
  const contact = process.env.NEXT_PUBLIC_SECURITY_CONTACT ?? DEFAULT_CONTACT;
  const encryption = process.env.NEXT_PUBLIC_SECURITY_PGP_URL ?? DEFAULT_ENCRYPTION;
  const canonical = process.env.NEXT_PUBLIC_SECURITY_CANONICAL ?? DEFAULT_CANONICAL;
  const policy = process.env.NEXT_PUBLIC_SECURITY_POLICY ?? DEFAULT_POLICY;
  const expires = process.env.NEXT_PUBLIC_SECURITY_EXPIRES ?? DEFAULT_EXPIRES;
  const languages = process.env.NEXT_PUBLIC_SECURITY_LANGUAGES ?? DEFAULT_LANGUAGES;

  const body = [
    `Contact: ${contact}`,
    `Expires: ${expires}`,
    `Encryption: ${encryption}`,
    `Preferred-Languages: ${languages}`,
    `Canonical: ${canonical}`,
    `Policy: ${policy}`,
    '',
  ].join('\n');

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
