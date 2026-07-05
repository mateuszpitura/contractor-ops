# 100-07 SUMMARY — API-key leak alarm cron

**Wave:** 3 · **Status:** complete · `api-key-leak-alarm.test.ts` GREEN (2/2); cron-worker typecheck clean.

## What shipped

- `apps/cron-worker/src/jobs/handlers/api-key-leak-alarm.ts` — `apiKeyLeakAlarmHandler`: reads the P99
  `ApiKeyIpEvent` log over a rolling 24h window, groups DISTINCT `ipAddress` per `apiKeyId`, and raises an
  alarm for any key with `> 3` distinct source IPs (`<= 3` does not alarm). The alarm is a Sentry
  `captureMessage` (the same alert mechanism as `job-health`) carrying the key PREFIX (never the plaintext
  key) + the distinct-IP count + the org id, plus a `jobs.apikey.leak_suspects` gauge. Idempotent within a
  day bucket (dedup on `apiKeyId + date`). Reads only the proxy-trusted `sourceIp` (a spoofed XFF cannot
  forge or suppress it — P99 already normalized the value).
- Registered hourly in `apps/cron-worker/src/jobs/registry.ts` with a new
  `CRON_API_KEY_LEAK_ALARM_SCHEDULE` (default `0 * * * *`) in the cron env schema + `.env.example`.

`ApiKeyIpEvent` is present (P99 merged) so the job runs unconditionally — no conditional-skip needed.

## Verify

`pnpm --filter @contractor-ops/cron-worker test api-key-leak-alarm` → 2/2 GREEN.
`pnpm --filter @contractor-ops/cron-worker typecheck` → clean.
