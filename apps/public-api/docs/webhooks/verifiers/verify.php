<?php

/**
 * Reference verifier for Contractor Ops outbound webhooks (PHP, stdlib only).
 *
 * Each delivery carries `X-CO-Signature: t={unix_ms},v1={hex}` where
 *   v1 = HMAC_SHA256(secret, "{t}.{rawBody}")  (hex).
 *
 * Verify with the per-subscription secret shown once at creation. Reject any
 * signature whose timestamp is outside a 5-minute window BEFORE comparing the
 * digest (this is your replay protection), then compare in constant time.
 */

const CO_WEBHOOK_FIVE_MINUTES_MS = 5 * 60 * 1000;

function co_verify_webhook_signature(
    string $secret,
    string $rawBody,
    string $signatureHeader,
    ?int $nowMs = null,
    int $toleranceMs = CO_WEBHOOK_FIVE_MINUTES_MS
): bool {
    if ($nowMs === null) {
        $nowMs = (int) round(microtime(true) * 1000);
    }

    $t = null;
    $v1 = null;
    foreach (explode(',', $signatureHeader) as $part) {
        $pair = explode('=', trim($part), 2);
        if (count($pair) !== 2) {
            continue;
        }
        [$key, $value] = $pair;
        if ($key === 't') {
            if (!ctype_digit($value)) {
                return false;
            }
            $t = (int) $value;
        } elseif ($key === 'v1') {
            $v1 = strtolower($value);
        }
    }

    if ($t === null || $v1 === null || strlen($v1) !== 64) {
        return false;
    }

    // Replay window — reject stale/future timestamps BEFORE the digest compare.
    if (abs($nowMs - $t) > $toleranceMs) {
        return false;
    }

    $expected = hash_hmac('sha256', $t . '.' . $rawBody, $secret);
    return hash_equals($expected, $v1);
}
