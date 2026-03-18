import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@contractor-ops/db",
    "@contractor-ops/auth",
    "@contractor-ops/api",
    "@contractor-ops/validators",
    "@contractor-ops/ui",
  ],
};

export default nextConfig;
