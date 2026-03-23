import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@contractor-ops/db";
import { Resend } from "resend";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Magic link tokens expire after 15 minutes. */
const MAGIC_LINK_EXPIRY_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Resend client (lazy init — mirrors notification-service.ts pattern)
// ---------------------------------------------------------------------------

let resendClient: Resend | null = null;

function getResend(): Resend {
  resendClient ??= new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

// ---------------------------------------------------------------------------
// Magic link token management
// ---------------------------------------------------------------------------

/**
 * Create a one-time magic link token for the given email.
 * The raw token is returned for inclusion in the email link;
 * only the SHA-256 hash is stored in the database.
 */
export async function createMagicLinkToken(
  email: string,
): Promise<{ token: string; expiresAt: Date }> {
  const rawToken = randomBytes(32).toString("base64url");
  const hashedToken = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MS);

  await prisma.portalMagicToken.create({
    data: {
      email: email.toLowerCase().trim(),
      token: hashedToken,
      expiresAt,
    },
  });

  return { token: rawToken, expiresAt };
}

/**
 * Verify a magic link token.
 * Returns the associated email if the token is valid, unused, and not expired.
 * Marks the token as used (sets `usedAt`) to enforce single-use semantics.
 * Returns null for invalid, expired, or already-used tokens.
 */
export async function verifyMagicLinkToken(
  rawToken: string,
): Promise<{ email: string } | null> {
  const hashedToken = createHash("sha256").update(rawToken).digest("hex");

  const record = await prisma.portalMagicToken.findUnique({
    where: { token: hashedToken },
  });

  if (!record) return null;
  if (record.usedAt) return null;
  if (record.expiresAt < new Date()) return null;

  // Mark as used atomically
  await prisma.portalMagicToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return { email: record.email };
}

// ---------------------------------------------------------------------------
// Contractor lookup (cross-org, no tenant scoping)
// ---------------------------------------------------------------------------

/**
 * Find all active contractor records matching an email across ALL organizations.
 * Used to determine which orgs the contractor has access to (D-15).
 *
 * The `prisma` import from @contractor-ops/db is the raw (unscoped) client,
 * so this query correctly bypasses tenant scoping for cross-org lookups.
 *
 * Returns empty array if no match — callers should always show the same
 * "check your email" response to prevent email enumeration (D-16).
 */
export async function findContractorsByEmail(email: string) {
  return prisma.contractor.findMany({
    where: {
      email: email.toLowerCase().trim(),
      status: "ACTIVE",
      deletedAt: null,
    },
    include: {
      organization: {
        select: { id: true, name: true, logo: true },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Email sending
// ---------------------------------------------------------------------------

/**
 * Send a portal magic link email.
 * Uses Resend in production (when RESEND_API_KEY is set) and console.log in dev.
 *
 * The caller should check if contractors exist for the email but ALWAYS show
 * the same "check your email" response to prevent enumeration (Pitfall 2 / D-16).
 */
export async function sendPortalMagicLink(opts: {
  email: string;
  token: string;
  baseUrl: string;
}): Promise<void> {
  const magicLinkUrl = `${opts.baseUrl}/portal/login/verify?token=${opts.token}`;

  if (process.env.RESEND_API_KEY) {
    const resend = getResend();
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "noreply@contractor-ops.com",
      to: opts.email,
      subject: "Sign in to Contractor Portal",
      html: `
        <p>Click the link below to sign in to the Contractor Portal:</p>
        <p><a href="${magicLinkUrl}">Sign in to Portal</a></p>
        <p>This link expires in 15 minutes.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
      `.trim(),
    });
  } else {
    console.log(
      `[DEV] Portal magic link for ${opts.email}: ${magicLinkUrl}`,
    );
  }
}
