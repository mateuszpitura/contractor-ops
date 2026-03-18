import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * 404 Not Found page.
 * Styled error page with CTA to return to dashboard.
 */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center px-4">
      <div className="space-y-4">
        <p className="text-6xl font-bold text-muted-foreground/30">404</p>
        <h1 className="text-[20px] font-semibold">Page not found</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The page you are looking for does not exist or has been moved.
        </p>
        <Button render={<Link href="/en/dashboard" />} className="mt-4">
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
