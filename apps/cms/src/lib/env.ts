import { z } from 'zod';

/**
 * Normalize a Render-style URL env var.
 *
 * `render.yaml` binds WEB_APP_URL (and similar private-network URLs) via
 * `fromService.property: hostport`, which Render resolves to a bare
 * `host:port` string with NO scheme. The downstream fetch caller expects a
 * full URL, and Zod's `.url()` validator rejects scheme-less inputs.
 *
 * Service-to-service traffic inside Render's private network is plain HTTP
 * (TLS is terminated at the public load balancer, not between pods), so
 * `http://` is the correct prefix to add when the scheme is missing.
 *
 * Values that already include a scheme (`http://`, `https://`) pass through
 * unchanged so local-dev defaults and explicit overrides keep working.
 */
function normalizeRenderUrl(raw: string): string {
  if (!raw) return raw;
  return /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
}

const ENV_SCHEMA = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  CMS_DATABASE_URL: z.string().default(''),
  PAYLOAD_SECRET: z.string().default(''),

  CMS_PUBLIC_URL: z.string().url().default('http://localhost:3002'),
  WEB_APP_URL: z
    .string()
    .default('http://localhost:3000')
    .transform(normalizeRenderUrl)
    .pipe(z.string().url()),

  CMS_WEBHOOK_SECRET: z.string().optional(),
  CMS_ADMIN_EMAIL: z.string().email().optional(),
  CMS_ADMIN_PASSWORD: z.string().min(8).optional(),

  R2_BUCKET_NAME: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
});

export type CmsEnv = z.infer<typeof ENV_SCHEMA>;

let cached: CmsEnv | null = null;

export function getCmsEnv(): CmsEnv {
  if (cached) {
    return cached;
  }
  const parsed = ENV_SCHEMA.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid CMS environment: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function requireCmsEnv<K extends keyof CmsEnv>(key: K): NonNullable<CmsEnv[K]> {
  const value = getCmsEnv()[key];
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required CMS env var: ${String(key)}`);
  }
  return value as NonNullable<CmsEnv[K]>;
}

export function hasR2Storage(env: CmsEnv = getCmsEnv()): boolean {
  return Boolean(
    env.R2_BUCKET_NAME && env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY,
  );
}
