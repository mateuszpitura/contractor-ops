import type { ReactNode } from "react";

/**
 * Auth layout: centered card on white/dark background.
 * Used for login, register, invite accept, and email verification screens.
 * No sidebar. Minimal chrome. 3xl (64px) vertical spacing for the card container.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md space-y-8">{children}</div>
    </div>
  );
}
