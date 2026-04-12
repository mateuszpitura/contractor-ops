import { Noto_Sans_Arabic } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { Providers } from "@/app/providers";
import { CookieConsentBanner } from "@/components/layout/cookie-consent-banner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { routing } from "@/i18n/routing";
import "@/app/globals.css";

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Root locale layout.
 * Wraps all locale-scoped pages with:
 * - NextIntlClientProvider (i18n messages + locale)
 * - ThemeProvider (dark mode with class strategy)
 * - TRPCProvider + QueryClientProvider (via Providers)
 * - TooltipProvider (shadcn tooltips)
 * - Sonner Toaster (toast notifications)
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();

  // Set lang and dir attributes on the html element for screen readers and RTL.
  // Sanitize locale to alphanumeric+hyphen only (defense in depth).
  const safeLang = locale.replace(/[^a-zA-Z0-9-]/g, "");
  const dir = locale === "ar" ? "rtl" : "ltr";
  const isArabic = locale === "ar";

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang="${safeLang}";document.documentElement.dir="${dir}";`,
        }}
      />
      <NextIntlClientProvider messages={messages}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>
            <TooltipProvider delay={300}>
              <div className={isArabic ? notoSansArabic.variable : undefined}>{children}</div>
              <CookieConsentBanner />
              <Toaster richColors position={dir === "rtl" ? "bottom-left" : "bottom-right"} />
            </TooltipProvider>
          </Providers>
        </ThemeProvider>
      </NextIntlClientProvider>
    </>
  );
}
