#!/bin/sh
# Usage: scripts/smoke-test.sh <base-url>
set -eu

BASE_URL=${1:?usage: smoke-test.sh <base-url>}
URL="${BASE_URL%/}/api/products/one-time"

echo "GET $URL"
for attempt in 1 2 3 4 5 6; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$URL" || true)
  if [ "$code" = "200" ]; then
    echo "OK"
    exit 0
  fi
  echo "Attempt $attempt: HTTP $code"
  sleep 10
done

echo "Smoke test failed. The build deployed but the app is not serving; check the CloudWatch logs for the Amplify app."
exit 1
