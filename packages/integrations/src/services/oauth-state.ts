import { createHmac, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// OAuth State — HMAC-signed CSRF protection with cross-provider validation
// Per Research Pitfall 1: include provider slug in state to prevent
// cross-provider CSRF attacks.
// ---------------------------------------------------------------------------

export interface OAuthStatePayload {
  /** Provider slug — prevents cross-provider CSRF */
  provider: string;
  orgId: string;
  userId: string;
  timestamp: number;
}

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generates an HMAC-signed, base64url-encoded OAuth state parameter.
 * Includes provider slug, org ID, user ID, and timestamp for CSRF protection.
 *
 * @param provider - Provider slug (e.g., "slack", "jira")
 * @param orgId - Organization ID initiating the OAuth flow
 * @param userId - User ID initiating the OAuth flow
 * @param signingSecret - Secret key for HMAC-SHA256 signature
 * @returns base64url-encoded JSON state string
 */
export function generateOAuthState(
  provider: string,
  orgId: string,
  userId: string,
  signingSecret: string,
): string {
  const timestamp = Date.now();
  const dataToSign = `${provider}:${orgId}:${userId}:${timestamp}`;
  const sig = createHmac("sha256", signingSecret).update(dataToSign).digest("hex");

  const payload = { provider, orgId, userId, timestamp, sig };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

/**
 * Verifies an HMAC-signed OAuth state parameter.
 * Checks signature validity, provider match, and timestamp freshness.
 *
 * @param stateParam - The base64url-encoded state string from the callback
 * @param expectedProvider - The provider slug from the URL (must match state)
 * @param signingSecret - Secret key for HMAC-SHA256 verification
 * @returns Decoded state payload if valid, null otherwise
 */
export function verifyOAuthState(
  stateParam: string,
  expectedProvider: string,
  signingSecret: string,
): OAuthStatePayload | null {
  try {
    const decoded = JSON.parse(Buffer.from(stateParam, "base64url").toString("utf-8")) as {
      provider: string;
      orgId: string;
      userId: string;
      timestamp: number;
      sig: string;
    };

    // Verify provider matches URL parameter (cross-provider CSRF protection)
    if (decoded.provider !== expectedProvider) return null;

    // Recompute HMAC and compare with timing-safe equality
    const dataToSign = `${decoded.provider}:${decoded.orgId}:${decoded.userId}:${decoded.timestamp}`;
    const expectedSig = createHmac("sha256", signingSecret).update(dataToSign).digest("hex");

    const sigBuffer = Buffer.from(decoded.sig, "hex");
    const expectedBuffer = Buffer.from(expectedSig, "hex");
    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }

    // Check timestamp freshness
    if (Date.now() - decoded.timestamp > STATE_MAX_AGE_MS) return null;

    return {
      provider: decoded.provider,
      orgId: decoded.orgId,
      userId: decoded.userId,
      timestamp: decoded.timestamp,
    };
  } catch {
    return null;
  }
}
