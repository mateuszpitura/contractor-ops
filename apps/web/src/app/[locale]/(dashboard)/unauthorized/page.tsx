import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * Unauthorized access page.
 * Shown when user tries to access a page they don't have permission for.
 */
export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <div className="space-y-4">
        <p className="text-6xl font-bold text-muted-foreground/30">403</p>
        <h1 className="text-[20px] font-semibold">Access denied</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          You do not have permission to view this page. Contact your admin if
          you think this is an error.
        </p>
        <Button render={<Link href="/en/dashboard" />} className="mt-4">
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
