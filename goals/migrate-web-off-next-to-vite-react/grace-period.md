# Grace period digest — post-cutover monitoring

Append one section per day during the 14-day grace period (plan.md Step 17).
Do not proceed to Step 18 until all days are green.

## Template (copy per day)

### YYYY-MM-DD

- **Commit / release**: `<git rev-parse HEAD>`
- **Sentry error rate**: ___ vs baseline ___ (±___%)
- **PostHog DAU**: ___ vs baseline ___ (±___%)
- **Web Vitals p75**: LCP ___ / INP ___ / CLS ___
- **Audit log volume**: ___ events (baseline ___)
- **Incidents**: none | `<link>`
- **Verdict**: green | rollback triggered

---

## Day 1

_Pending cutover — no entries yet._
