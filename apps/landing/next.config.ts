import type { NextConfig } from 'next';

// Note: this app uses `output: 'export'` in production — Next.js `headers()`
// is silently no-op at runtime under static export. Security headers ship
// via Render's `headers:` block in render.yaml (landing service, ~L288).
//
// In development we disable static export so dynamic CMS-driven slugs
// (`/blog/[slug]`, `/blog/author/[handle]`, `/blog/tag/[tag]`) can be
// fetched on-demand without requiring `generateStaticParams()` to enumerate
// every Payload post up-front. Production builds (Render `pnpm build`) run
// with NODE_ENV=production and re-enable `output: 'export'`.
const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  ...(isDev ? {} : { output: 'export' }),
  // `next/image`'s default loader needs a running optimizer, which is absent
  // under `output: 'export'`. Bypass it so blog hero images (CMS-driven,
  // relative or absolute URLs) render as plain optimized markup with the
  // layout-shift guarantees `<Image>` provides over a raw `<img>`.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
