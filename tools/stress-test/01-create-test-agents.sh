#!/usr/bin/env bash
# Creates N test agents with streamingMode=external via the API.
# Usage: bash 01-create-test-agents.sh [N=50]
#
# Requires: API_URL, ADMIN_TOKEN env vars
# Produces: stream_keys.txt, agent_ids.txt

set -euo pipefail

N="${1:-50}"

: "${API_URL:?Set API_URL (e.g. https://api-production-1866.up.railway.app)}"
: "${ADMIN_TOKEN:?Set ADMIN_TOKEN (admin JWT)}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KEYS_FILE="$SCRIPT_DIR/stream_keys.txt"
IDS_FILE="$SCRIPT_DIR/agent_ids.txt"

> "$KEYS_FILE"
> "$IDS_FILE"

echo "Creating $N test agents..."

created=0
failed=0

for i in $(seq 1 "$N"); do
  slug="stress-test-$(printf '%03d' "$i")"
  name="Stress Test $i"

  response=$(curl -s -w "\n%{http_code}" \
    -X POST "$API_URL/agents" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d "{\"slug\":\"$slug\",\"name\":\"$name\",\"streamingMode\":\"external\"}")

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
    agent_id=$(echo "$body" | jq -r '.id')
    stream_key=$(echo "$body" | jq -r '.streamKey')

    echo "$slug|$agent_id|$stream_key" >> "$KEYS_FILE"
    echo "$agent_id" >> "$IDS_FILE"
    created=$((created + 1))
    echo "  [$created/$N] $slug → key=${stream_key:0:8}..."
  else
    failed=$((failed + 1))
    echo "  [FAIL] $slug → HTTP $http_code: $(echo "$body" | jq -r '.message // .error // "unknown"' 2>/dev/null || echo "$body")"
  fi
done

echo ""
echo "Done: $created created, $failed failed"
echo "Keys file: $KEYS_FILE"
echo "IDs file:  $IDS_FILE"
