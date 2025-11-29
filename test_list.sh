#!/usr/bin/env bash
set -euo pipefail

# Simple test to call the list endpoint and check for productIds
CLOUD_RUN_URL="${CLOUD_RUN_URL:-https://certificate-validation-180908610681.europe-southwest1.run.app}"

echo "[test-list] Using Cloud Run URL: $CLOUD_RUN_URL" >&2

RESPONSE=$(curl -sS -X GET "$CLOUD_RUN_URL/certificates" -H "Accept: application/json") || {
  echo "[test-list] curl failed" >&2
  exit 1
}

echo "[test-list] Response: $RESPONSE" >&2

if echo "$RESPONSE" | grep -q '"productIds"'; then
  echo "[test-list] OK: productIds present" >&2
  exit 0
else
  echo "[test-list] FAIL: productIds not present" >&2
  exit 2
fi
