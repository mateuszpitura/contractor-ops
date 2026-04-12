import type { Metadata } from "next";
import { defaultLocale } from "@/i18n";

export const metadata: Metadata = {
  other: {
    refresh: `0;url=/${defaultLocale}`,
  },
};

/**
 * Root page — immediate redirect to default locale.
 * Uses meta refresh for static export compatibility.
 */
export default function RootPage() {
  return <meta httpEquiv="refresh" content={`0;url=/${defaultLocale}`} />;
}
