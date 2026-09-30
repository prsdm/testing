#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_URL="${SANDBOX_EXECUTOR_URL:-http://127.0.0.1:8089}"
TENANT_ID="${SANDBOX_TEST_TENANT_ID:-tenant-local}"
USER_ID="${SANDBOX_TEST_USER_ID:-user-local}"
CHAT_ID="${SANDBOX_TEST_CHAT_ID:-chat-local}"

echo "Health check: ${BASE_URL}/health"
curl -fsS "${BASE_URL}/health" | python3 -m json.tool

echo
echo "Exec python hello world"
curl -fsS -X POST "${BASE_URL}/v1/exec" \
  -H 'Content-Type: application/json' \
  -d "$(python3 - <<EOF
import json
print(json.dumps({
  "tenantId": "${TENANT_ID}",
  "userId": "${USER_ID}",
  "chatId": "${CHAT_ID}",
  "command": "python",
  "args": ["-c", "from pathlib import Path; Path('hello.txt').write_text('hello from sandbox')"],
  "cwd": "outputs",
  "timeoutMs": 10000,
}))
EOF
)" | python3 -m json.tool

OUTPUT_FILE="${ROOT}/.sandbox-sessions/${TENANT_ID}/${USER_ID}/sessions/${CHAT_ID}/outputs/hello.txt"
if [[ ! -f "${OUTPUT_FILE}" ]]; then
  echo "Expected output file missing: ${OUTPUT_FILE}" >&2
  exit 1
fi

echo
echo "Output file contents:"
cat "${OUTPUT_FILE}"

echo
echo "Path jail rejection"
STATUS="$(curl -s -o /tmp/sandbox-path-jail.json -w '%{http_code}' -X POST "${BASE_URL}/v1/exec" \
  -H 'Content-Type: application/json' \
  -d "$(python3 - <<EOF
import json
print(json.dumps({
  "tenantId": "${TENANT_ID}",
  "userId": "${USER_ID}",
  "chatId": "${CHAT_ID}",
  "command": "python",
  "args": ["-c", "print('ignored')"],
  "cwd": "uploads/../etc",
  "timeoutMs": 5000,
}))
EOF
)")"

if [[ "${STATUS}" != "400" ]]; then
  echo "Expected HTTP 400 for invalid cwd, got ${STATUS}" >&2
  cat /tmp/sandbox-path-jail.json >&2
  exit 1
fi

python3 -m json.tool /tmp/sandbox-path-jail.json
echo
echo "Phase 0 sandbox checks passed."
