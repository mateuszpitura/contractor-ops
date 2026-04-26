# `infra/aws-me/` — AWS ME-region stack (dormant until needed)

Terraform scaffolding for a parallel production stack in AWS `me-south-1` (Bahrain) or `me-central-1` (UAE). **Not applied.** Committed so that if a customer contract mandates physical Middle East data residency, the cutover work is configuration + review, not greenfield design.

See `docs/TECH-DEBT.md` §2 for the business context and trigger criteria.

---

## What this stack contains

- **VPC** — 3 AZs, public + private + database subnets, NAT per AZ, VPC Flow Logs, VPC endpoints (S3 gateway + ECR / Secrets Manager / Logs interface) to keep AWS-service traffic off NAT.
- **ECS Fargate cluster** with these services:
  - `web` (Next.js standalone, autoscale 2..8, fronted by ALB)
  - `public-api` (Hono Enterprise REST API, autoscale 2..6, fronted by ALB on a separate subdomain)
  - `worker` (node-cron scheduler, fixed 1 instance, no ingress)
  - `unleash` (self-hosted feature flags, private-only, reached at `unleash.contractor-ops-me.local:4242` via service discovery) — see `unleash.tf`
  - `clamav` (virus scanner with EFS-backed signatures, `clamav.contractor-ops-me.local:3310`) — see `clamav.tf`
  - `cloudflared` (admin-access tunnel, `desired_count=0` by default — resume on-demand) — see `admin-tunnel.tf`
  - `migrator` (long-running sleep task for Prisma migrations + ad-hoc psql via ECS Execute Command) — see `migrations.tf`
- **EventBridge Scheduler** — two schedules: `token-refresh` every 15 min, `data-purge` daily 03:00 UTC. Each runs a tiny curl Fargate task targeting the ALB (`cron.tf`).
- **Aurora PostgreSQL Serverless v2** — Postgres 16, writer + replica, auto-scaling 0.5–4 ACU, encrypted at rest, 30-day backup retention. Shared by the app and Unleash (separate DBs).
- **RDS Proxy** — connection pooling + ~1s failover handoff in front of Aurora. Flip `DATABASE_URL` to the proxy endpoint once the app is validated against it (`rds-proxy.tf`).
- **ElastiCache (Valkey 8)** — in-region cache + rate-limit store, primary + replica across AZs, AUTH token + TLS. Replaces Upstash for ME once the `@upstash/redis` → `ioredis` code refactor lands (TECH-DEBT §1) — provisioned now so that's a config change, not an infra change.
- **EFS** — persistent storage for ClamAV signatures (avoids re-downloading ~300MB from freshclam on every task restart).
- **Application Load Balancer** — HTTPS-only (TLS 1.3), ACM DNS-validated cert covering both public subdomains (`app.*` + `api.*`), HTTP→HTTPS redirect, access logs to S3 (90-day lifecycle). Log bucket policy handles both legacy and post-2022-Aug region principal formats.
- **AWS WAF** — attached to ALB. Three rule groups: `AWSManagedRulesCommonRuleSet` (OWASP baseline), `AWSManagedRulesKnownBadInputsRuleSet`, and a per-IP rate limit (2000 req/5min).
- **ECR** — three repos with `IMMUTABLE` tags, scan-on-push, keep-last-20 lifecycle.
- **S3 bucket** — document storage (replaces R2 for ME tenants), versioned, encrypted, public access blocked.
- **Secrets Manager** — Aurora master credentials, `DATABASE_URL`, Unleash DB URL, Cloudflare Tunnel token, Valkey AUTH URL, and a JSON blob (`app-secrets`) whose keys are injected individually into ECS task env vars via Secrets Manager JSON key selectors (not as one blob env var).
- **Service Discovery (Cloud Map)** — private DNS zone `contractor-ops-me.local` for internal services (Unleash, ClamAV). App tasks resolve them by name without hardcoded IPs.
- **Route53** — A-alias records for `app.<domain>` and `api.<domain>`. The hosted zone itself is NOT managed here.
- **CloudTrail** — explicit multi-region trail with S3 (7y retention, Glacier after 90d) + CloudWatch Logs (1y retention) + log-file validation. Satisfies compliance requirements beyond the default 90-day management-events trail.
- **CloudWatch** — ECS log groups per service (90d), Container Insights, VPC Flow Logs, and these alarms: ALB 5xx rate, ALB unhealthy targets (web + public-api), ALB p95 latency > 2s, Fargate memory > 90% (5 services), Aurora at max capacity, Aurora CPU > 80%, Aurora deadlocks, worker not running, cache memory > 80%, cron invocation failures (2), WAF high block rate, monthly budget > 80% actual / 100% forecasted.

## What this stack does NOT contain (intentionally)

- **Route53 hosted zone** — created out-of-band so Terraform cannot accidentally delete it. Only records inside an existing zone are managed.
- **ACM wildcard cert** — ALB cert covers only the two subdomains this stack publishes. If you add more, update `subject_alternative_names` in `alb.tf`.
- **KMS customer-managed keys** — AES256 (AWS-managed) is used throughout. Add a CMK only if compliance explicitly requires it — it complicates cross-account access and adds $1/key/mo per key.
- **GitHub Actions OIDC role** — create the role in the AWS console when wiring CI. Keeping it out of this stack means the stack can be applied from a laptop without bootstrapping CI first.
- **Cross-region replication from the EU stack** — ME data must NOT be copied to EU (that defeats the point). If a feature needs aggregate data across regions, do it in the app layer with per-region read-only connections.
- **PagerDuty / Opsgenie integration** — the SNS topic exists; subscribe your paging service manually after apply.
- **Infisical self-host** — hosted Infisical (app.infisical.com) is used for secret storage on the EU side; create a separate **ME project** in that same hosted account and point the ME stack at it via `INFISICAL_PROJECT_ID` in `app-secrets`. Self-hosting Infisical on AWS ME adds ~$40/mo and another DB dependency for no compliance benefit (the secrets are encrypted end-to-end before transit regardless of region).
- **AWS Client VPN** — rejected in favor of Cloudflare Tunnel. Client VPN has ~$73/mo idle baseline + $0.10/hr per connection, defeats the on-demand goal. If a customer contract literally specifies "access via VPN" as a compliance control, add an `aws_ec2_client_vpn_endpoint` resource and SAML federation with Google Workspace — not done here because no current requirement justifies the cost.

---

## Bootstrap (one-time, before the first apply)

This stack uses an S3 backend. The bucket and DynamoDB lock table must exist before `terraform init` can succeed.

```bash
export AWS_REGION=me-south-1
export AWS_PROFILE=contractor-ops-me

# Create state bucket
aws s3api create-bucket \
  --bucket contractor-ops-tfstate-me-south-1 \
  --region "$AWS_REGION" \
  --create-bucket-configuration LocationConstraint="$AWS_REGION"

aws s3api put-bucket-versioning \
  --bucket contractor-ops-tfstate-me-south-1 \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket contractor-ops-tfstate-me-south-1 \
  --server-side-encryption-configuration '{
    "Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]
  }'

aws s3api put-public-access-block \
  --bucket contractor-ops-tfstate-me-south-1 \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Create lock table
aws dynamodb create-table \
  --table-name contractor-ops-tfstate-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$AWS_REGION"
```

Create a Route53 hosted zone for the ME domain (e.g. `me.contractor-ops.com`) in this same AWS account before `terraform apply`. The stack looks up the zone by `var.domain_name` — it will not create it.

Set the subscription on the alerts SNS topic after apply (replace `<topic-arn>` with the value in outputs):

```bash
aws sns subscribe \
  --topic-arn "<topic-arn>" \
  --protocol email \
  --notification-endpoint oncall@contractor-ops.com
```

---

## Apply

```bash
cp terraform.tfvars.example terraform.tfvars
# Fill in domain_name, image_tag, sentry_dsn

terraform init \
  -backend-config="bucket=contractor-ops-tfstate-me-south-1" \
  -backend-config="key=aws-me/terraform.tfstate" \
  -backend-config="region=me-south-1" \
  -backend-config="dynamodb_table=contractor-ops-tfstate-locks" \
  -backend-config="encrypt=true"

terraform plan -out=plan.tfplan
terraform apply plan.tfplan
```

Expect ~25 minutes for the first apply (Aurora cluster provisioning dominates).

---

## Post-apply steps

1. **Fill in `app-secrets`.** The bootstrap JSON in Secrets Manager has `TODO_replace_after_first_apply` placeholders for every real secret. Replace them all via the AWS console or:
   ```bash
   aws secretsmanager get-secret-value \
     --secret-id contractor-ops-me-production-app-secrets \
     --query SecretString --output text | jq . > current-secrets.json
   # edit current-secrets.json
   aws secretsmanager put-secret-value \
     --secret-id contractor-ops-me-production-app-secrets \
     --secret-string file://current-secrets.json
   rm current-secrets.json
   ```
2. **Force ECS to pick up the new secrets:**
   ```bash
   for svc in web public-api worker; do
     aws ecs update-service \
       --cluster contractor-ops-me-production-cluster \
       --service "contractor-ops-me-production-$svc" \
       --force-new-deployment
   done
   ```
3. **Push Docker images to ECR** (if not already handled by the CI mirror workflow):
   ```bash
   aws ecr get-login-password --region me-south-1 | \
     docker login --username AWS --password-stdin \
     <account-id>.dkr.ecr.me-south-1.amazonaws.com

   docker tag contractor-ops/web:<sha> \
     <account-id>.dkr.ecr.me-south-1.amazonaws.com/contractor-ops/web:<sha>
   docker push <account-id>.dkr.ecr.me-south-1.amazonaws.com/contractor-ops/web:<sha>
   # repeat for public-api
   ```
4. **Run Prisma migrations** against the new Aurora cluster. Use a one-off Fargate task OR port-forward via SSM Session Manager from a local machine and run `pnpm prisma migrate deploy` with `DATABASE_URL` set to the Secrets Manager value.
5. **Validate:**
   ```bash
   curl -fsS https://app.me.contractor-ops.com/api/health
   curl -fsS https://api.me.contractor-ops.com/api/v1/health
   ```
6. **Bootstrap the Unleash database** on the shared Aurora cluster. Use SSM Session Manager to open a psql shell against the cluster, then:
   ```sql
   CREATE DATABASE unleash;
   CREATE USER unleash_app WITH PASSWORD '<read from random_password.unleash_db in tfstate>';
   GRANT ALL PRIVILEGES ON DATABASE unleash TO unleash_app;
   ```
   Then force redeploy the `unleash` service so it picks up the DB and runs its own migrations on startup.
7. **Create Unleash server-side API tokens** in the Unleash UI (accessed via the Cloudflare Tunnel — see below), then update `UNLEASH_URL_ME` and `UNLEASH_API_TOKEN_ME` in `app-secrets`:
   - `UNLEASH_URL_ME = "http://unleash.contractor-ops-me.local:4242/api/"`
   - `UNLEASH_API_TOKEN_ME = "<from Unleash UI>"`
8. **Configure the Cloudflare Tunnel** — in the Cloudflare Zero Trust dashboard, create a tunnel, paste its token into the `cloudflare-tunnel-token` Secrets Manager secret, and map hostnames (e.g. `unleash-me.internal.contractor-ops.com`) to `http://unleash.contractor-ops-me.local:4242`. Attach an Access Application with Google Workspace SSO + MFA.
9. **Create a separate ME project in hosted Infisical** (app.infisical.com) and update `INFISICAL_PROJECT_ID` in `app-secrets`. Do NOT reuse the EU project — that would link ME secrets to EU audit trails.
10. **Run Prisma migrations** against the new Aurora cluster. Use a one-off Fargate task OR port-forward via SSM Session Manager from a local machine and run `pnpm prisma migrate deploy` with `DATABASE_URL` set to the Secrets Manager value.
11. **Validate:**
    ```bash
    curl -fsS https://app.me.contractor-ops.com/api/health
    curl -fsS https://api.me.contractor-ops.com/api/v1/health
    ```
12. **Wire app-level tenant routing** on the EU stack so that `org.dataRegion === 'ME'` tenants get their DB / storage clients pointed at the ME stack. See `packages/api/src/services/tenant-region-router.ts` (to be added when this stack is actually provisioned).

---

## Admin access (on-demand, via Cloudflare Tunnel)

The `cloudflared` ECS service is created with `desired_count = 0`. While scaled to zero, Fargate does not bill for the task — same on-demand model as Render.

```bash
export AWS_PROFILE=contractor-ops-me
export CLUSTER=contractor-ops-me-production-cluster
export TUNNEL_SVC=contractor-ops-me-production-cloudflared

# Resume — tunnel comes up in ~30s and starts accepting Cloudflare Access traffic
aws ecs update-service --cluster $CLUSTER --service $TUNNEL_SVC --desired-count 1

# Browse to https://unleash-me.internal.contractor-ops.com (Google SSO prompt)
# …do admin work…

# Suspend — billing stops within a minute
aws ecs update-service --cluster $CLUSTER --service $TUNNEL_SVC --desired-count 0
```

The `lifecycle { ignore_changes = [desired_count] }` block on `aws_ecs_service.cloudflared` means subsequent `terraform apply` runs will NOT fight your manual scaling.

**Cost:** 0.25 vCPU + 512MB Fargate for 1h/day ≈ $0.40/month. Suspended = $0. Cloudflare Tunnel + Access (up to 50 users) are free.

---

## Deploy updates

New app version:

```bash
# 1. CI builds and pushes the image to ECR (via .github/workflows/ecr-mirror.yml).
# 2. Bump image_tag in terraform.tfvars.
# 3. terraform apply — ECS rolls both web + public-api with deployment_circuit_breaker
#    enabled, so a failing deploy auto-rolls back.
```

Secret rotation:

```bash
# Edit the JSON blob in Secrets Manager (console or CLI).
# Force new deployment on all 3 services to pick up the new values.
# Terraform does NOT manage secret values (ignore_changes on secret_string).
```

---

## Tear down (non-prod only)

```bash
# Remove deletion_protection first (requires one terraform apply with
# db_deletion_protection = false).
terraform destroy
# Then manually delete the tfstate bucket + DynamoDB table.
```

**Never run `terraform destroy` against production ME.** Data loss is permanent — Aurora backups are retained for 30 days after cluster deletion, but S3 document versions disappear with the bucket.

---

## Cost baseline (Bahrain, me-south-1, empty stack)

| Component | Monthly (USD, empty/idle) |
|---|---|
| VPC + 3x NAT Gateway | ~$100 (NAT is the dominant baseline cost) |
| ALB | ~$20 |
| ECS Fargate (2×web + 2×public-api + 1×worker, 24/7) | ~$60 |
| Aurora Serverless v2 (idle at 0.5 ACU, 2 instances) | ~$85 |
| S3 + CloudWatch + Secrets Manager | ~$15 |
| **Baseline total** | **~$280/month** |

Add traffic-driven: Fargate scales, Aurora ACU scales, S3 storage + egress, CloudWatch log ingestion. At modest ME-tenant load (a few hundred users, GB-level document storage) expect ~$350–500/mo. Compare to Render EU (~$60/mo base) — the ME residency guarantee is expensive.

---

## Why I didn't use [official module X]

- **terraform-aws-modules/ecs/aws** exists but adds abstraction layers that make it harder to tune individual services. For 3 services with distinct configs, explicit `aws_ecs_service` resources read cleaner.
- **terraform-aws-modules/rds-aurora/aws** IS used — it correctly handles the Serverless v2 + provisioned-mode combination that raw resources get wrong.
- **terraform-aws-modules/vpc/aws** IS used — VPC config is tedious and well-trodden; no reason to reinvent.
