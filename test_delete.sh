#!/usr/bin/env bash
set -euo pipefail

# Test to delete all certificates for a product via DELETE /certificates/:productId
CLOUD_RUN_URL="${CLOUD_RUN_URL:-https://certificate-validation-180908610681.europe-southwest1.run.app}"
PRODUCT_ID="${1:-ISCC-PLUS-Cert-US201-134022025}"

if [ -z "$PRODUCT_ID" ]; then
  echo "Usage: $0 <productId>" >&2
  exit 1
fi

echo "[test-delete] Using Cloud Run URL: $CLOUD_RUN_URL" >&2
echo "[test-delete] Deleting productId: $PRODUCT_ID" >&2

RESPONSE=$(curl -sS -X DELETE "$CLOUD_RUN_URL/certificates/$PRODUCT_ID" -H "Content-Type: application/json") || {
  echo "[test-delete] curl failed" >&2
  exit 1
}

echo "[test-delete] Response: $RESPONSE" >&2

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "[test-delete] Delete succeeded" >&2
  exit 0
else
  echo "[test-delete] Delete failed" >&2
  exit 2
fi
