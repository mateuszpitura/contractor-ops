import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono, Noto_Sans_Arabic, Outfit } from "next/font/google";
import type { ReactNode } from "react";
import { PostHogProvider } from "@/lib/posthog";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
});

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Contractor Ops — B2B Contractor Management",
  description:
    "Contracts, onboarding, invoices, approvals, payments and offboarding — all in one place.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${bricolageGrotesque.variable} ${jetbrainsMono.variable} ${notoSansArabic.variable} font-sans`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                let theme = localStorage.getItem('theme');
                if (theme === '"dark"' || theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
                // Set lang and dir from URL locale segment
                const seg = location.pathname.split('/')[1];
                if (seg === 'ar') {
                  document.documentElement.lang = 'ar';
                  document.documentElement.dir = 'rtl';
                  document.documentElement.classList.add('font-arabic');
                  document.documentElement.classList.remove('font-sans');
                } else if (seg === 'pl') {
                  document.documentElement.lang = 'pl';
                } else if (seg === 'de') {
                  document.documentElement.lang = 'de';
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
