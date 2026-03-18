import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * Dashboard home page.
 * Shows empty state with welcome message and CTA to add first contractor.
 */
export default function DashboardPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="text-[20px] font-semibold">
        Welcome to Contractor Ops
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Your organization is set up. Start by adding your first contractor.
      </p>
      <Button render={<Link href="/en/contractors/new" />} className="mt-6">
        Add contractor
      </Button>
    </div>
  );
}
