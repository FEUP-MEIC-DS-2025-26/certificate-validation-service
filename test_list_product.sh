#!/usr/bin/env bash
set -euo pipefail

# Simple test to call the list endpoint and check for productIds
CLOUD_RUN_URL="${CLOUD_RUN_URL:-http://localhost:8081}"

echo "[test-list] Using Cloud Run URL: $CLOUD_RUN_URL" >&2

RESPONSE=$(curl -sS -X GET "$CLOUD_RUN_URL/certificates/bananao-001" -H "Accept: application/json") || {
  echo "[test-list] curl failed" >&2
  exit 1
}

echo "====================\nTest with productId that exists\n===================="
echo "[test-list] Response: $RESPONSE" >&2

if echo "$RESPONSE" | grep -q '"id"'; then
  echo "[test-list] OK: certificate ids present" >&2
else
  echo "[test-list] FAIL: certificate ids not present" >&2
  exit 2
fi

echo "====================\nTest with productId that doesn't exist\n===================="
RESPONSE=$(curl -sS -X GET "$CLOUD_RUN_URL/certificates/bananao-002" -H "Accept: application/json") || {
  echo "[test-list] curl failed" >&2
  exit 1
}

echo "[test-list] Response: $RESPONSE" >&2

if echo "$RESPONSE" | grep -q '\[]'; then
  echo "[test-list] OK: empty list" >&2
  exit 0
else
  echo "[test-list] FAIL" >&2
  exit 2
fi
