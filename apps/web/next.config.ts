import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@contractor-ops/auth",
    "@contractor-ops/api",
    "@contractor-ops/validators",
    "@contractor-ops/ui",
  ],
  serverExternalPackages: [
    "@contractor-ops/db",
  ],
};

export default nextConfig;
