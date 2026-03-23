import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "frame-src 'self' https://*.docusign.com https://*.docusign.net https://apps-d.docusign.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
