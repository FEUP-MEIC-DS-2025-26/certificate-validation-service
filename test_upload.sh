#!/usr/bin/env bash
set -euo pipefail

# === CONFIGURATION ===
CLOUD_RUN_URL="${CLOUD_RUN_URL:-https://certificate-validation-180908610681.europe-southwest1.run.app}"
PRODUCT_ID="${1:-bananao-001}"
# Default to a local test PDF (file name no longer needs to match productId)
PDF_PATH="${2:-test_to_send/spiderweb.pdf}"
CERTIFICATE_ID="${3:-ISCC-CORSIA-Cert-US201-2440920252}"

if [ ! -f "$PDF_PATH" ]; then
  echo "ERROR: File not found: $PDF_PATH" >&2
  exit 1
fi

if [ -z "${CERTIFICATE_ID:-}" ]; then
  echo "ERROR: certificateId is required as the 3rd argument" >&2
  echo "Usage: $0 <productId> <pdf_path> <certificateId>" >&2
  exit 1
fi

echo "[test-upload] Using Cloud Run URL: $CLOUD_RUN_URL" >&2
echo "[test-upload] Product ID: $PRODUCT_ID" >&2
echo "[test-upload] PDF path: $PDF_PATH" >&2

TMP_B64=$(mktemp)
TMP_JSON=$(mktemp)

# Ensure temp files are removed on exit
cleanup() {
  rm -f "$TMP_B64" "$TMP_JSON"
}
trap cleanup EXIT

# 1) Base64 into temp file (no huge argv)
base64 -w0 "$PDF_PATH" > "$TMP_B64"

# 2) Build JSON by hand, streaming into TMP_JSON
{
  printf '{'
  printf '"productId":"%s",' "$PRODUCT_ID"
    printf '"certificateId":"%s",' "$CERTIFICATE_ID"
  printf '"file":"'
  cat "$TMP_B64" | sed 's/"/\\"/g'
  printf '"}'
} > "$TMP_JSON"

echo "[test-upload] Sending request..." >&2

# 3) POST the JSON file; capture response
RESPONSE=$(cat "$TMP_JSON" | curl -sS -X POST "$CLOUD_RUN_URL/certificates/upload" \
  -H "Content-Type: application/json" \
  -d @- ) || {
  echo "[test-upload] curl failed" >&2
  exit 1
}

echo
echo "[test-upload] Response: $RESPONSE" >&2

# check for success flag in response (simple string check)
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "[test-upload] Upload succeeded" >&2
  exit 0
else
  echo "[test-upload] Upload failed" >&2
  exit 2
fi