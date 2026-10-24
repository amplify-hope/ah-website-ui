#!/bin/sh
# Usage: scripts/smoke-test.sh <base-url>
set -eu

BASE_URL=${1:?usage: smoke-test.sh <base-url>}
URL="${BASE_URL%/}/api/products/one-time"
ATTEMPTS=${SMOKE_ATTEMPTS:-6}
INTERVAL_SECONDS=${SMOKE_INTERVAL_SECONDS:-10}

echo "GET $URL"
attempt=1
while [ "$attempt" -le "$ATTEMPTS" ]; do
  # The timeouts keep an origin that accepts the connection and never answers
  # from holding the job until GitLab's own timeout.
  code=$(curl -sS -L --connect-timeout 5 --max-time 15 -o /dev/null \
    -w '%{http_code}' "$URL" || true)
  if [ "$code" = "200" ]; then
    echo "OK"
    exit 0
  fi
  echo "Attempt $attempt/$ATTEMPTS: HTTP $code"
  if [ "$attempt" -lt "$ATTEMPTS" ]; then
    sleep "$INTERVAL_SECONDS"
  fi
  attempt=$((attempt + 1))
done

echo "Smoke test failed. The build deployed but the app is not serving; check the CloudWatch logs for the Amplify app."
exit 1
