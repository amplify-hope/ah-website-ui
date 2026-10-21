#!/bin/sh
# Usage: scripts/amplify-deploy.sh <amplify-branch>
set -eu

BRANCH=${1:?usage: amplify-deploy.sh <amplify-branch>}
: "${AMPLIFY_APP_ID:?}" "${AWS_REGION:?}"
: "${NEXT_PUBLIC_APP_ENV:?}" "${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:?}" "${NEXT_PUBLIC_SENTRY_DSN:?}"
: "${SENTRY_AUTH_TOKEN:?}" "${AH_SECRET_ID:?}" "${AH_AWS_REGION:?}"

TIMEOUT_SECONDS=${AMPLIFY_TIMEOUT_SECONDS:-1500}
CONSOLE_URL="https://${AWS_REGION}.console.aws.amazon.com/amplify/apps/${AMPLIFY_APP_ID}/branches/${BRANCH}/deployments"
INPUT=$(mktemp)
JOB_ID=""

amplify() {
  command=$1
  shift
  aws amplify "$command" --app-id "$AMPLIFY_APP_ID" --branch-name "$BRANCH" "$@"
}

stop_job() {
  if [ -n "$JOB_ID" ]; then
    echo "Stopping Amplify job $JOB_ID"
    amplify stop-job --job-id "$JOB_ID" >/dev/null || true
  fi
}

trap 'rm -f "$INPUT"' EXIT
trap 'stop_job; exit 1' INT TERM

jq -n \
  --arg app "$AMPLIFY_APP_ID" --arg branch "$BRANCH" \
  --arg appEnv "$NEXT_PUBLIC_APP_ENV" \
  --arg stripeKey "$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" \
  --arg sentryDsn "$NEXT_PUBLIC_SENTRY_DSN" \
  --arg sentryToken "$SENTRY_AUTH_TOKEN" \
  --arg secretId "$AH_SECRET_ID" --arg region "$AH_AWS_REGION" \
  '{
    appId: $app,
    branchName: $branch,
    environmentVariables: {
      NEXT_PUBLIC_APP_ENV: $appEnv,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: $stripeKey,
      NEXT_PUBLIC_SENTRY_DSN: $sentryDsn,
      SENTRY_AUTH_TOKEN: $sentryToken,
      AH_SECRET_ID: $secretId,
      AH_AWS_REGION: $region
    }
  }' >"$INPUT"

echo "Setting build variables on Amplify branch $BRANCH"
aws amplify update-branch --cli-input-json "file://$INPUT" >/dev/null

JOB_ID=$(amplify start-job --job-type RELEASE \
  --job-reason "GitLab pipeline ${CI_PIPELINE_ID:-local}, commit ${CI_COMMIT_SHORT_SHA:-unknown}" \
  --query jobSummary.jobId --output text)
echo "Started Amplify job $JOB_ID: $CONSOLE_URL"

deadline=$(($(date +%s) + TIMEOUT_SECONDS))
while :; do
  status=$(amplify get-job --job-id "$JOB_ID" --query job.summary.status --output text || echo UNKNOWN)
  echo "$(date +%T) $status"
  case "$status" in
    SUCCEED) exit 0 ;;
    FAILED | CANCELLED)
      amplify get-job --job-id "$JOB_ID" --query 'job.steps[].[stepName,status]' --output text || true
      echo "Amplify build $status. Logs: $CONSOLE_URL"
      exit 1
      ;;
  esac
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "Amplify build did not finish within ${TIMEOUT_SECONDS}s"
    stop_job
    exit 1
  fi
  sleep 15
done
