import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { Providers } from "@/app/providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/app/globals.css";

/**
 * Root locale layout.
 * Wraps all locale-scoped pages with:
 * - ThemeProvider (dark mode with class strategy)
 * - TRPCProvider + QueryClientProvider (via Providers)
 * - TooltipProvider (shadcn tooltips)
 * - Sonner Toaster (toast notifications)
 *
 * Plan 04 will later add NextIntlClientProvider here.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <Providers>
        <TooltipProvider delay={300}>
          {children}
          <Toaster richColors position="bottom-right" />
        </TooltipProvider>
      </Providers>
    </ThemeProvider>
  );
}
