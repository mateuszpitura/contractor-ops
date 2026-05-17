import { z } from 'zod';

const ENV_SCHEMA = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  CMS_DATABASE_URL: z.string().default(''),
  PAYLOAD_SECRET: z.string().default(''),

  CMS_PUBLIC_URL: z.string().url().default('http://localhost:3002'),
  WEB_APP_URL: z.string().url().default('http://localhost:3000'),

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
