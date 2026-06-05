# Can Claude actually run the campaign? — honest capability map

> Straight answer: **yes for most of the build + monitoring, given API keys — but the SEND button, payments, your face, and legal stay human.** Below is exactly what I can drive, how, what I need from you, and where the hard limits are. No overpromising.

## What "I run it" means here

In this Claude Code environment I have: **Bash (curl → any REST API)**, **PostHog MCP** (native), **Google Drive/Gmail/Calendar MCP** (interactive-auth), **semble**, **agent-browser** (drive web UIs without APIs), **Workflow/subagents** (orchestration), and **/schedule + /loop** (recurring jobs). I do **not** have a magic "log into any SaaS and click" — for tools without an API I'd use agent-browser (brittle, and ToS-risky on LinkedIn). "Claude cowork / computer-use" is a *different* product surface; not what's running in this repo session.

## Per-tool matrix

| Tool | REST API? | Native MCP here? | Can I drive it? | Needs from you | Side-effect gate |
|------|-----------|------------------|-----------------|----------------|------------------|
| **Apollo** | yes | no (curl) | ✅ search + enrich + pull leads via API → write to Sheet | API key | read-only, safe |
| **MillionVerifier** | yes | no (curl) | ✅ batch-verify emails via API | API key | read-only, safe |
| **Clay** | yes/webhooks | no | ⚠️ partial — table/webhook driven; I can trigger HTTP, less full control | API key + table setup | low |
| **Instantly** | yes | no (curl) | ✅ create campaign, upload verified leads, set sequences, pull stats | API key | ⛔ **SEND = your authorization** |
| **HubSpot** | yes | no (curl) | ✅ create/update contacts + deals + pull pipeline | private-app token | write to CRM, low risk |
| **Cal.com** | yes/webhooks | no (curl) | ✅ read bookings, configure event types, wire webhooks | API key | low |
| **Cloudflare DNS** | yes | no (curl) | ✅ create SPF/DKIM/DMARC/MX records from domains.csv | API token (scoped DNS:edit) | DNS change — confirm first |
| **Google Sheets** | yes | via Drive MCP / curl | ✅ build tabs, write rows, formulas | OAuth / service acct | low |
| **PostHog** | yes | ✅ **native MCP** | ✅ define events, build insights/dashboards, query | project access | low |
| **Substack** | no real API | no | ❌ mostly manual (agent-browser brittle) | you publish | n/a |
| **LinkedIn** | no (ToS-locked) | no | ⛔ **avoid** — automation = ToS breach + ban risk | — | do not automate |
| **Loom** | n/a | no | ❌ your face/voice — human | you record | n/a |
| **Canva / one-pager** | API exists | no | ⚠️ I draft content; you design | you | n/a |
| **iubenda (legal)** | n/a | no | ❌ you click generate; I draft Impressum/ROPA text | you | n/a |

## What I can OWN end-to-end (given keys, with the send-gate)

1. **List build** — Apollo API: per-cell searches matching `cells.csv` → pull → dedupe → write to Sheet.
2. **Intent-trigger overlay** — partial: Apollo job-change/funding filters via API; hiring-post scrape needs agent-browser or a scraper key (brittle) — likely faster you/manual for JustJoin/NoFluff.
3. **Verify** — MillionVerifier API → tag valid/risky/catch-all → drop bad.
4. **Sheet sync** — maintain the whole `gtm-wave-1` Sheet (rows, status, formulas) live.
5. **Instantly setup** — create the campaign, upload verified leads, load the copy sequences from `copy_templates.csv`, set schedule/caps. **I stage it; you press launch.**
6. **DNS** — Cloudflare API: apply every record in `domains.csv` (confirm before write).
7. **PostHog** — MCP: create the event taxonomy + the 5-tab-equivalent insights.
8. **Monitoring loop** — /schedule or /loop or a cron: pull Instantly + Cal + PostHog stats → update Sheet/dashboard → post anomalies to Slack (bounce spike, reply, booking). Semi-autonomous ops.
9. **All copy/content/lead-magnet/legal-text drafting** — already doing.
10. **Iteration proposals** — read dashboard verdicts → propose scale/kill/A-B per `dashboard_spec.md` rules → you approve.

## What stays HUMAN (you)

- **Pay** for subscriptions + **buy domains** (payment methods).
- **Record Loom** (your identity).
- **The SEND go-live** — cold email is outward-facing, reputation-and-legally-significant. I prepare + stage everything; **you authorize each campaign launch.** I will not autonomously blast.
- **Legal review + E&O + entity** (`legal-stack.md` / `positioning-and-liability.md`).
- **Live demo calls + partnership/sales conversations** (relationship).
- **Anything needing your personal login where no API key/token is provided.**

## Governance / hard rules

- **Send authorization is per-campaign, explicit.** Even with full Instantly access, state changes that send or publish need your OK. Monitoring/iteration can run semi-autonomously; sends cannot.
- **DNS / outbound / publish = confirm before executing** (irreversible/outward-facing).
- **LinkedIn automation = no.** ToS + ban risk. Manual only.
- **Cost control.** API calls that consume paid credits (Apollo, MV) — I'll batch + report usage, not burn blindly.
- **Credentials.** Give scoped keys (least privilege: e.g. Cloudflare DNS:edit only, HubSpot private-app with needed scopes). Never paste keys in chat history you don't want logged — prefer a `.env`/secret store I read via Bash.

## Caveats that bite

- **Headless/scheduled runs may lose interactive-auth MCPs.** The Google (claude.ai) MCP authenticates interactively; a cron/`/schedule` job may not have it. REST-API-via-curl (Apollo/Instantly/HubSpot/Cloudflare with stored keys) survives headless; OAuth-interactive MCPs may not. So the autonomous monitor should lean on key-based REST, not the Google MCP.
- **agent-browser is brittle** for anything stateful/auth-walled. Fine for a one-off scrape, not a reliable daily pipeline.
- **I can't see real-world deliverability** (inbox placement, spam folder) via API alone — needs a seed-test tool (e.g. Mailreach/GlockApps) or your manual check.

## Realistic operating model

**You become: approver + payer + on-camera + relationship-owner.**
**I become: the operator** — build lists, verify, stage campaigns, wire DNS, run PostHog, maintain the Sheet, run the monitoring loop, draft everything, propose iterations.

Concretely, to flip me from "orchestration" to "operator", give me (in a `.env` or secret store, scoped):
`APOLLO_API_KEY`, `MILLIONVERIFIER_API_KEY`, `INSTANTLY_API_KEY`, `HUBSPOT_TOKEN`, `CLOUDFLARE_API_TOKEN` (DNS:edit), `CALCOM_API_KEY`, a Google service account for Sheets, PostHog project access. Then I can stand up the pipeline and you just approve launches.

## Suggested division for wave 1

| Stage | Owner |
|-------|-------|
| Subscriptions + domains + Workspace + payments | you |
| DNS records applied | me (Cloudflare API, you confirm) |
| Loom recording | you |
| Legal v1 (iubenda) + Impressum | you (I draft text) |
| List build + verify + Sheet | me (Apollo + MV API) |
| Instantly campaign staged | me |
| **Launch authorization** | **you** |
| Monitoring + alerts + iteration proposals | me (scheduled) |
| Demo calls + partnerships | you |

## Cross-refs

- `tools_stack.csv` — the tools + costs
- `dashboard_spec.md` — the monitoring loop I'd run
- `legal-stack.md` — what must be true before I stage a send
