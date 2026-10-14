# whitelabel fork: cron service that calls cap-web /api/cron/* on the schedule
# of crontab (self-hosted replacement for the crons of apps/web/vercel.json).
# Dokploy: application loom-cron-*, Dockerfile scripts/whitelabel/cron/Dockerfile,
# context scripts/whitelabel/cron. Env: CAP_WEB_URL, CRON_SECRET.
FROM alpine:3.22

RUN apk add --no-cache ca-certificates curl supercronic tzdata \
	&& adduser -D -H -s /sbin/nologin capcron

COPY crontab /etc/cap-cron/crontab
COPY cap-cron.sh /usr/local/bin/cap-cron

ENV TZ=UTC
USER capcron

CMD ["/usr/bin/supercronic", "-passthrough-logs", "/etc/cap-cron/crontab"]
