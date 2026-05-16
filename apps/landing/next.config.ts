import type { NextConfig } from 'next';

// Note: this app uses `output: 'export'` — Next.js `headers()` is silently
// no-op at runtime under static export. Security headers ship via Render's
// `headers:` block in render.yaml (landing service, ~L288). Source of truth
// for landing is render.yaml; for the SSR `web` app, this file's headers()
// block (apps/web/next.config.ts) remains authoritative.

const nextConfig: NextConfig = {
  output: 'export',
};

export default nextConfig;
