// Reference verifier for Contractor Ops outbound webhooks (Go, stdlib only).
//
// Each delivery carries `X-CO-Signature: t={unix_ms},v1={hex}` where
//
//	v1 = HMAC_SHA256(secret, fmt.Sprintf("%d.%s", t, rawBody))  (hex).
//
// Verify with the per-subscription secret shown once at creation. Reject any
// signature whose timestamp is outside a 5-minute window BEFORE comparing the
// digest (this is your replay protection), then compare in constant time.
package webhooks

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"strings"
	"time"
)

const fiveMinutesMs int64 = 5 * 60 * 1000

// VerifyWebhookSignature reports whether signatureHeader is a valid, in-window
// signature of rawBody under secret. Pass nowMs = time.Now().UnixMilli().
func VerifyWebhookSignature(secret string, rawBody []byte, signatureHeader string, nowMs int64) bool {
	var t int64
	var v1 string
	haveT, haveV1 := false, false

	for _, part := range strings.Split(signatureHeader, ",") {
		kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(kv) != 2 {
			continue
		}
		switch kv[0] {
		case "t":
			parsed, err := strconv.ParseInt(kv[1], 10, 64)
			if err != nil {
				return false
			}
			t, haveT = parsed, true
		case "v1":
			v1, haveV1 = strings.ToLower(kv[1]), true
		}
	}

	if !haveT || !haveV1 || len(v1) != 64 {
		return false
	}

	// Replay window — reject stale/future timestamps BEFORE the digest compare.
	delta := nowMs - t
	if delta < 0 {
		delta = -delta
	}
	if delta > fiveMinutesMs {
		return false
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(strconv.FormatInt(t, 10) + "."))
	mac.Write(rawBody)
	expected := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(expected), []byte(v1))
}

// Convenience helper mirroring the other verifiers' default clock.
func VerifyWebhookSignatureNow(secret string, rawBody []byte, signatureHeader string) bool {
	return VerifyWebhookSignature(secret, rawBody, signatureHeader, time.Now().UnixMilli())
}
