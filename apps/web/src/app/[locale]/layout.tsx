import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Providers } from "@/app/providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CookieConsentBanner } from "@/components/layout/cookie-consent-banner";
import { routing } from "@/i18n/routing";
import "@/app/globals.css";

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

  // Set lang attribute on the html element for screen readers.
  // Sanitize locale to alphanumeric+hyphen only (defense in depth).
  const safeLang = locale.replace(/[^a-zA-Z0-9-]/g, "");

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang="${safeLang}";` }} />
      <NextIntlClientProvider messages={messages}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <Providers>
          <TooltipProvider delay={300}>
            {children}
            <CookieConsentBanner />
            <Toaster richColors position="bottom-right" />
          </TooltipProvider>
        </Providers>
      </ThemeProvider>
    </NextIntlClientProvider>
    </>
  );
}
