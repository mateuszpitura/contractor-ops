"use client";

import { Button } from "@/components/ui/button";

/**
 * 500 Error page.
 * Client component with reset capability.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center px-4">
      <div className="space-y-4">
        <p className="text-6xl font-bold text-muted-foreground/30">500</p>
        <h1 className="text-[20px] font-semibold">Something went wrong</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          We are working on fixing this. Please try again in a moment.
        </p>
        <Button onClick={reset} className="mt-4">
          Try again
        </Button>
      </div>
    </div>
  );
}
