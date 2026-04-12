import { Link } from "@/i18n/navigation";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center px-6">
          <Link href="/" className="text-lg font-semibold">
            Contractor Ops
          </Link>
        </div>
      </header>
      <main className="container mx-auto max-w-3xl px-6 py-12">{children}</main>
      <footer className="border-t py-8">
        <div className="container mx-auto flex gap-6 px-6 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:underline">
            Terms of Service
          </Link>
          <Link href="/sub-processors" className="hover:underline">
            Sub-processors
          </Link>
          <Link href="/breach-notification" className="hover:underline">
            Breach Notification
          </Link>
        </div>
      </footer>
    </div>
  );
}
