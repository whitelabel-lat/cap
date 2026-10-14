#!/bin/sh
# whitelabel fork: call one cap-web cron route with CRON_SECRET as Bearer token.
# Usage: cap-cron /api/cron/<name>
# Env: CAP_WEB_URL (internal URL of cap-web), CRON_SECRET.
set -eu

path="${1:?usage: cap-cron /api/cron/<name>}"
: "${CAP_WEB_URL:?CAP_WEB_URL is not set}"
: "${CRON_SECRET:?CRON_SECRET is not set}"

# The header goes through a curl config on stdin so the secret never shows up
# in the process list.
printf 'header = "Authorization: Bearer %s"\n' "$CRON_SECRET" |
	curl --config - --silent --show-error --max-time 600 \
		--write-out '\nHTTP %{http_code} %{time_total}s\n' \
		--fail-with-body "${CAP_WEB_URL%/}$path"
