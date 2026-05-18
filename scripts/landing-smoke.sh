#!/usr/bin/env bash
# Landing smoke check — fetches each launch-market URL and asserts HTTP 200
# + that the response body contains the expected market wedge string.
#
# Usage: BASE_URL=https://contractor-ops.com bash scripts/landing-smoke.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4173}"
FAIL=0

# market path → wedge string the page must include
declare -a CHECKS=(
  "pl|KSeF"
  "de|ZUGFeRD"
  "en|EU compliance"
  "en-GB|IR35"
  "ar|Peppol"
  "ar-SA|زاتكا"
)

for entry in "${CHECKS[@]}"; do
  IFS='|' read -r locale wedge <<<"$entry"
  url="$BASE_URL/$locale"
  printf 'GET %s ... ' "$url"
  body=$(curl -fsSL --max-time 10 "$url" || true)
  if [[ -z "$body" ]]; then
    echo "FAIL (no body)"
    FAIL=1
    continue
  fi
  if grep -q "$wedge" <<<"$body"; then
    echo "OK"
  else
    echo "FAIL (wedge '$wedge' missing)"
    FAIL=1
  fi

  printf 'GET %s/pricing ... ' "$url"
  if curl -fsSL --max-time 10 "$url/pricing" >/dev/null; then
    echo "OK"
  else
    echo "FAIL"
    FAIL=1
  fi
done

if [[ $FAIL -ne 0 ]]; then
  echo "smoke check FAILED" >&2
  exit 1
fi

echo "smoke check OK"
