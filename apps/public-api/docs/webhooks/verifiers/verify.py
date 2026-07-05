"""
Reference verifier for Contractor Ops outbound webhooks (Python 3, stdlib only).

Each delivery carries `X-CO-Signature: t={unix_ms},v1={hex}` where
    v1 = HMAC_SHA256(secret, f"{t}.{raw_body}")  (hex).

Verify with the per-subscription secret shown once at creation. Reject any
signature whose timestamp is outside a 5-minute window BEFORE comparing the
digest (this is your replay protection), then compare in constant time.
"""

import hashlib
import hmac
import time

FIVE_MINUTES_MS = 5 * 60 * 1000


def verify_webhook_signature(
    secret: str,
    raw_body: bytes,
    signature_header: str,
    now_ms: int | None = None,
    tolerance_ms: int = FIVE_MINUTES_MS,
) -> bool:
    if now_ms is None:
        now_ms = int(time.time() * 1000)

    t: int | None = None
    v1: str | None = None
    for part in signature_header.split(","):
        key, _, value = part.strip().partition("=")
        if key == "t":
            try:
                t = int(value)
            except ValueError:
                return False
        elif key == "v1":
            v1 = value.lower()

    if t is None or v1 is None or len(v1) != 64:
        return False

    # Replay window — reject stale/future timestamps BEFORE the digest compare.
    if abs(now_ms - t) > tolerance_ms:
        return False

    signed = f"{t}.".encode("utf-8") + raw_body
    expected = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, v1)
